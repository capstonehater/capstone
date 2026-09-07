import { Injectable } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';

type OutboxPayload = Record<string, unknown>;
type OutboxEventHandler = (payload: OutboxPayload) => Promise<void>;

@Injectable()
export class OutboxConsumerRegistryService {
  private readonly handlers: Record<string, OutboxEventHandler>;

  constructor(private readonly alertsService: AlertsService) {
    this.handlers = {
      'order.completed': (payload) => this.handleOperationalRefresh(payload),
      'stock-run.posted': (payload) => this.handleOperationalRefresh(payload),
      'inventory.adjusted': (payload) => this.handleOperationalRefresh(payload),
      'inventory.waste-logged': (payload) =>
        this.handleOperationalRefresh(payload),
      'order.voided': (payload) => this.handleOperationalRefresh(payload),
      'order.refunded': (payload) => this.handleOperationalRefresh(payload),
    };
  }

  async consume(eventType: string, payload: unknown) {
    const handler = this.handlers[eventType];

    if (!handler) {
      throw new Error(
        `No outbox consumer is registered for event type "${eventType}"`,
      );
    }

    await handler((payload ?? {}) as OutboxPayload);
  }

  private async handleOperationalRefresh(payload: OutboxPayload) {
    const rawMaterialIds = Array.isArray(payload.rawMaterialIds)
      ? payload.rawMaterialIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : typeof payload.rawMaterialId === 'string'
        ? [payload.rawMaterialId]
        : [];

    await this.alertsService.syncOperationalAlertsForRawMaterialIds(
      rawMaterialIds,
    );
  }
}
