import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { isBackgroundJobsEnabled } from '../config/env.validation';
import { AlertsService } from './alerts.service';

const REEVALUATION_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class AlertReevaluationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertReevaluationService.name);
  private reevaluationTimer?: NodeJS.Timeout;
  private reevaluationInFlight = false;

  constructor(private readonly alertsService: AlertsService) {}

  onModuleInit() {
    if (!isBackgroundJobsEnabled()) {
      this.logger.log(
        'Background alert reevaluation jobs are disabled for this runtime.',
      );
      return;
    }

    if (this.reevaluationTimer) {
      return;
    }

    this.reevaluationTimer = setInterval(() => {
      void this.reevaluateNow();
    }, REEVALUATION_INTERVAL_MS);

    void this.reevaluateNow();
  }

  onModuleDestroy() {
    if (this.reevaluationTimer) {
      clearInterval(this.reevaluationTimer);
      this.reevaluationTimer = undefined;
    }
  }

  async reevaluateNow() {
    if (this.reevaluationInFlight) {
      return;
    }

    this.reevaluationInFlight = true;
    try {
      await this.alertsService.reevaluateAllOperationalAlerts();
    } catch (error) {
      this.logger.error(
        'Failed to reevaluate operational alerts',
        error as Error,
      );
    } finally {
      this.reevaluationInFlight = false;
    }
  }
}
