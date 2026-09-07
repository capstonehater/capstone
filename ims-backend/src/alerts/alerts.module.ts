import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertReevaluationService } from './alert-reevaluation.service';
import { AlertsService } from './alerts.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertReevaluationService],
  exports: [AlertsService],
})
export class AlertsModule {}
