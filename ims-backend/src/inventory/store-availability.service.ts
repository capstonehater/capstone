import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

const TIMEOUT = 10 * 60 * 1000;

@Injectable()
export class StoreAvailabilityService {
  private starting = new Set<string>();
  constructor(private readonly prisma: PrismaService) {}

  async latest(rawMaterialId: string) {
    // A stopped server must not leave a permanently spinning modal.
    await this.prisma.storeAvailabilitySearch.updateMany({
      where: {
        rawMaterialId,
        status: { in: ['PENDING', 'RANKING'] },
        createdAt: { lt: new Date(Date.now() - 2 * TIMEOUT) },
      },
      data: {
        status: 'FAILED',
        error: 'Search timed out. Please try again.',
        completedAt: new Date(),
      },
    });
    return this.prisma.storeAvailabilitySearch.findFirst({
      where: { rawMaterialId },
      orderBy: { createdAt: 'desc' },
      include: { results: true },
    });
  }

  async start(rawMaterialId: string) {
    if (this.starting.has(rawMaterialId))
      throw new BadRequestException('A search is already starting.');
    this.starting.add(rawMaterialId);
    try {
      const material = await this.prisma.rawMaterial.findUnique({
        where: { id: rawMaterialId },
      });
      if (!material) throw new NotFoundException('Material not found.');
      const latest = await this.latest(rawMaterialId);
      if (latest && ['PENDING', 'RANKING'].includes(latest.status))
        return latest;
      const suppliers = await this.prisma.supplier.findMany({
        orderBy: { name: 'asc' },
      });
      if (!suppliers.length)
        throw new BadRequestException(
          'Add stores in Manage Suppliers before searching.',
        );
      if (suppliers.length > 30)
        throw new BadRequestException(
          'Store search supports up to 30 registered suppliers per search.',
        );
      const search = await this.prisma.storeAvailabilitySearch.create({
        data: { rawMaterialId, productName: material.name },
        include: { results: true },
      });
      const stores = suppliers.map((supplier) => ({
        supplier_id: supplier.id,
        name: supplier.name,
        formatted_address: supplier.address ?? '',
        latitude: supplier.latitude === null ? null : Number(supplier.latitude),
        longitude:
          supplier.longitude === null ? null : Number(supplier.longitude),
        place_id: '',
      }));
      void this.execute(search.id, material.name, stores).catch(() => {
        // Persistence outages are recovered by the stale-job check above.
      });
      return search;
    } finally {
      this.starting.delete(rawMaterialId);
    }
  }

  private async execute(id: string, product: string, stores: unknown[]) {
    try {
      const results = await this.runPython({
        product,
        stores,
        collect_only: true,
      });
      const saved = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.storeAvailabilitySearch.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'RANKING' },
        });
        if (updated.count)
          await tx.storeAvailabilityResult.createMany({
            data: results.map((payload) => ({ searchId: id, payload })),
          });
        return updated.count > 0;
      });
      if (!saved) return;
      if (
        results.length > 0 &&
        results.every((row) =>
          ['ERROR', 'RATE_LIMIT', 'PAYLOAD_TOO_LARGE'].includes(
            String(row.status),
          ),
        )
      ) {
        // Preserve diagnostic rows, but do not label a provider outage as success.
        throw new ServiceUnavailableException('All store searches failed.');
      }

      // Read committed evidence back from the database before sending it to Qwen.
      const records = await this.prisma.storeAvailabilityResult.findMany({
        where: { searchId: id },
        orderBy: { id: 'asc' },
      });
      const ranked = await this.runPython({
        product,
        results: records.map(
          (record) => record.payload as Prisma.InputJsonObject,
        ),
        persisted: true,
      });
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.storeAvailabilitySearch.updateMany({
          where: { id, status: 'RANKING' },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        if (!updated.count) return;
        for (const [index, record] of records.entries()) {
          await tx.storeAvailabilityResult.update({
            where: { id: record.id },
            data: { payload: ranked[index] },
          });
        }
      });
    } catch {
      await this.prisma.storeAvailabilitySearch.updateMany({
        where: { id, status: { in: ['PENDING', 'RANKING'] } },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error:
            'Store search or ranking could not finish. Any saved search evidence is still available. Check provider configuration and try again.',
        },
      });
    }
  }

  private runPython(input: {
    product: string;
    stores?: unknown[];
    results?: Prisma.InputJsonObject[];
    collect_only?: boolean;
    persisted?: boolean;
  }): Promise<Prisma.InputJsonObject[]> {
    const script = resolve(
      input.persisted
        ? (process.env.STORE_RECOMMENDATION_SCRIPT ??
            resolve(process.cwd(), '../AI-Store Reco/store_recommendation.py'))
        : (process.env.STORE_PRICE_SCRIPT ??
            resolve(process.cwd(), '../AI-Store Reco/store_price.py')),
    );
    return new Promise((accept, reject) => {
      const child = spawn(
        process.env.STORE_SEARCH_PYTHON ?? 'python',
        [script],
        {
          cwd: dirname(script),
          shell: false,
          windowsHide: true,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      let output = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new ServiceUnavailableException('Search timed out.'));
      }, TIMEOUT);
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(
          error instanceof Error ? error : new Error('Invalid worker response'),
        );
      });
      child.stdin.on('error', () => {
        /* Exit handler reports worker failure. */
      });
      child.stderr.resume(); // Do not expose provider responses or credentials to clients.
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        output += chunk;
        if (output.length > 2_000_000) {
          child.kill();
          reject(new Error('Worker output exceeded limit.'));
        }
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error('Python search failed.'));
          return;
        }
        try {
          const parsed = JSON.parse(output) as {
            results: Prisma.InputJsonObject[];
          };
          if (
            !Array.isArray(parsed.results) ||
            parsed.results.length !==
              (input.results ?? input.stores ?? []).length ||
            parsed.results.some(
              (row) =>
                !row ||
                typeof row.store_name !== 'string' ||
                typeof row.status !== 'string',
            )
          ) {
            throw new Error('Invalid worker response.');
          }
          if (
            input.results &&
            parsed.results.some(
              (row, index) =>
                row.supplier_id !== input.results![index].supplier_id ||
                row.store_name !== input.results![index].store_name ||
                !row.recommendation ||
                typeof row.recommendation !== 'object',
            )
          ) {
            throw new Error('Invalid recommendation identity.');
          }
          accept(parsed.results);
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('Invalid worker response'),
          );
        }
      });
      child.stdin.end(JSON.stringify(input));
    });
  }
}
