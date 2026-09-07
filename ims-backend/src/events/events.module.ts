import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { OutboxService } from './outbox.service';
import { OutboxConsumerRegistryService } from './outbox-consumer-registry.service';
import { OutboxProcessorService } from './outbox-processor.service';

@Module({
  imports: [AlertsModule],
  providers: [
    OutboxService,
    OutboxConsumerRegistryService,
    OutboxProcessorService,
  ],
  exports: [OutboxService],
})
export class EventsModule {}
