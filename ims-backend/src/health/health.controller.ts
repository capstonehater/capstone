import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { hostname } from 'node:os';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get()
  async ready() {
    try {
      await this.prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`SELECT 1`;
        },
        { maxWait: 1000, timeout: 2000 },
      );
      return { status: 'ok', instance: hostname() };
    } catch {
      throw new ServiceUnavailableException('Service is not ready');
    }
  }
}
