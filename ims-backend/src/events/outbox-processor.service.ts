import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import { isBackgroundJobsEnabled } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxConsumerRegistryService } from './outbox-consumer-registry.service';

const PROCESS_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 15000;

@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private pollTimer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly consumerRegistry: OutboxConsumerRegistryService,
  ) {}

  onModuleInit() {
    if (!isBackgroundJobsEnabled()) {
      this.logger.log(
        'Background outbox processing jobs are disabled for this runtime.',
      );
      return;
    }

    if (this.pollTimer) {
      return;
    }

    this.pollTimer = setInterval(() => {
      void this.processPendingEvents();
    }, PROCESS_INTERVAL_MS);

    void this.processPendingEvents();
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  async processPendingEvents() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (true) {
        const claimed = await this.claimNextEvent();

        if (!claimed) {
          break;
        }

        await this.processClaimedEvent(claimed);
      }
    } finally {
      this.processing = false;
    }
  }

  private async claimNextEvent() {
    const candidate = await this.prisma.outboxEvent.findFirst({
      where: {
        status: OutboxStatus.PENDING,
        availableAt: {
          lte: new Date(),
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (!candidate) {
      return null;
    }

    const claimed = await this.prisma.outboxEvent.updateMany({
      where: {
        id: candidate.id,
        status: OutboxStatus.PENDING,
      },
      data: {
        status: OutboxStatus.PROCESSING,
        attempts: {
          increment: 1,
        },
        errorMessage: null,
      },
    });

    if (claimed.count === 0) {
      return null;
    }

    return this.prisma.outboxEvent.findUnique({
      where: { id: candidate.id },
    });
  }

  private async processClaimedEvent(event: {
    id: string;
    eventType: string;
    payload: Prisma.JsonValue;
    attempts: number;
  }) {
    this.logger.log(
      `Processing outbox event ${event.id} (${event.eventType}) attempt ${event.attempts}`,
    );

    try {
      await this.consumerRegistry.consume(event.eventType, event.payload);

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.COMPLETED,
          processedAt: new Date(),
          errorMessage: null,
        },
      });

      this.logger.log(
        `Completed outbox event ${event.id} (${event.eventType})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldFail = event.attempts >= MAX_ATTEMPTS;

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: shouldFail ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          availableAt: shouldFail
            ? undefined
            : new Date(Date.now() + BASE_RETRY_DELAY_MS * event.attempts),
          errorMessage: message.slice(0, 1000),
          processedAt: shouldFail ? new Date() : null,
        },
      });

      if (shouldFail) {
        this.logger.error(
          `Outbox event ${event.id} (${event.eventType}) failed permanently: ${message}`,
        );
      } else {
        this.logger.warn(
          `Outbox event ${event.id} (${event.eventType}) failed and will retry: ${message}`,
        );
      }
    }
  }
}
