import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { spawn, ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { loadPosHistory } from './pos-history';
import { validateWorkerResult } from './forecasting.types';

const TIMEOUT_MS = 30 * 60 * 1000;

@Injectable()
export class ForecastingService implements OnModuleDestroy {
  private readonly logger = new Logger(ForecastingService.name);
  private readonly children = new Set<ChildProcess>();
  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() { for (const child of this.children) child.kill(); }

  async products() {
    return { products: await this.prisma.product.findMany({
      where: { archivedAt: null, isEnabled: true },
      select: { id: true, name: true }, orderBy: { name: 'asc' },
    }) };
  }

  private async expireAbandonedRuns() {
    await this.prisma.forecastRun.updateMany({
      where: { status: 'RUNNING', createdAt: { lt: new Date(Date.now() - TIMEOUT_MS - 60000) } },
      data: { status: 'FAILED', activeKey: null, error: 'Forecast worker was interrupted or exceeded its time limit. Please generate again.', completedAt: new Date() },
    });
  }

  async latest(productId?: string) {
    await this.expireAbandonedRuns();
    let materialIds: string[] | undefined;
    if (productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, archivedAt: null, isEnabled: true },
        include: { variants: { where: { isEnabled: true }, include: { recipeItems: true } },
          productModifierGroups: { include: { modifierGroup: { include: { modifiers: {
            where: { isActive: true }, include: { recipeAdjustments: true },
          } } } } } },
      });
      if (!product) throw new NotFoundException('Product is not available');
      materialIds = [...new Set([
        ...product.variants.flatMap((variant) => variant.recipeItems.map((item) => item.rawMaterialId)),
        ...product.productModifierGroups.flatMap((group) => group.modifierGroup.modifiers.flatMap((modifier) => modifier.recipeAdjustments.map((item) => item.rawMaterialId))),
      ])];
    }
    const [run, activeRun] = await Promise.all([
      this.prisma.forecastRun.findFirst({ where: { status: 'COMPLETED' }, orderBy: { createdAt: 'desc' },
        include: { series: { where: materialIds ? { materialId: { in: materialIds } } : undefined,
          orderBy: { name: 'asc' }, include: { points: { orderBy: { date: 'asc' } }, recommendation: true } } },
      }),
      this.prisma.forecastRun.findFirst({ where: { status: 'RUNNING' }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { run, activeRun, scope: productId ? 'Store-wide demand for the raw materials used by this product.' : 'Store-wide raw-material demand.' };
  }

  async run(id: string) {
    await this.expireAbandonedRuns();
    const run = await this.prisma.forecastRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Forecast run not found');
    return { run };
  }

  async generate(startDate: string) {
    const start = new Date(`${startDate}T00:00:00Z`);
    if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== startDate) throw new BadRequestException('Select a valid start date');
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
    await this.expireAbandonedRuns();
    const existing = await this.prisma.forecastRun.findUnique({ where: { activeKey: 'forecast' } });
    if (existing) return { run: existing };
    try {
      const run = await this.prisma.forecastRun.create({ data: { startDate: start, endDate: end, activeKey: 'forecast' } });
      void this.execute(run.id, startDate).catch((error: unknown) => this.logger.error(error instanceof Error ? error.message : 'Forecast persistence failed'));
      return { run };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { run: await this.prisma.forecastRun.findUniqueOrThrow({ where: { activeKey: 'forecast' } }) };
      }
      throw error;
    }
  }

  private async execute(runId: string, startDate: string) {
    let directory: string | undefined;
    try {
      const { materials, pos } = await this.prisma.$transaction(async (tx) => {
        const capturedAt = new Date();
        const materials = await tx.rawMaterial.findMany({ where: { isActive: true }, include: { unit: true, summary: true } });
        const pos = await loadPosHistory(tx, startDate, capturedAt);
        return { materials, pos };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
      directory = await mkdtemp(join(tmpdir(), 'ims-forecast-'));
      const input = join(directory, 'input.json');
      const output = join(directory, 'output.json');
      await writeFile(input, JSON.stringify({ startDate, ...pos, materials: materials.map((material) => ({
        id: material.id, name: material.name, sku: material.sku, unit: material.unit.code,
        currentStock: material.summary ? Number(material.summary.usableQuantity) : null,
        reorderPoint: Number(material.reorderPoint),
      })) }), 'utf8');
      const pythonDirectory = resolve(process.env.FORECAST_PYTHON_DIR || join(process.cwd(), '..', 'python'));
      await this.runPython(pythonDirectory, input, output);
      const result = validateWorkerResult(JSON.parse(await readFile(output, 'utf8')) as unknown, startDate);
      const validIds = new Set(materials.map((material) => material.id));
      if (result.series.some((series) => !validIds.has(series.materialId))) throw new Error('Python returned an unknown material');
      await this.prisma.$transaction(async (tx) => {
        // A terminated or expired run must never overwrite its terminal status.
        const claimed = await tx.forecastRun.updateMany({ where: { id: runId, status: 'RUNNING' }, data: {
          status: 'COMPLETED', activeKey: null, completedAt: new Date(), historyEnd: new Date(result.historyEnd),
          sourceHash: result.sourceHash, warnings: result.warnings,
        } });
        if (claimed.count !== 1) throw new Error('Forecast run is no longer active');
        for (const series of result.series) {
          await tx.forecastSeries.create({ data: {
            runId, materialId: series.materialId, name: series.name, unit: series.unit,
            metadata: series.metadata as Prisma.InputJsonObject,
            points: { create: series.points.map((point) => ({ ...point, date: new Date(point.date) })) },
            recommendation: { create: { data: series.recommendation as Prisma.InputJsonObject } },
          } });
        }
      }, { timeout: 60000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Forecast generation failed';
      this.logger.warn(message);
      await this.prisma.forecastRun.updateMany({ where: { id: runId, status: 'RUNNING' }, data: {
        status: 'FAILED', activeKey: null, error: message.slice(0, 1500), completedAt: new Date(),
      } });
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }

  private runPython(directory: string, input: string, output: string) {
    return new Promise<void>((resolvePromise, reject) => {
      const child = spawn(process.env.FORECAST_PYTHON_EXECUTABLE || 'python',
        [join(directory, 'forecast_bridge.py'), '--input', input, '--output', output],
        { cwd: directory, shell: false, windowsHide: true, env: { ...process.env, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['ignore', 'ignore', 'pipe'] });
      this.children.add(child);
      let stderr = '';
      let timedOut = false;
      child.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-1500); });
      const timer = setTimeout(() => { timedOut = true; child.kill(); }, TIMEOUT_MS);
      child.on('error', (error) => { clearTimeout(timer); this.children.delete(child); reject(new Error(`Could not start Python: ${error.message}`)); });
      child.on('close', (code) => {
        clearTimeout(timer); this.children.delete(child);
        if (timedOut) reject(new Error('Forecast timed out after 30 minutes.'));
        else if (code !== 0) reject(new Error(stderr.trim() || `Python exited with code ${code}`));
        else resolvePromise();
      });
    });
  }
}
