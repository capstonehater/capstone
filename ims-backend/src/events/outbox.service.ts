import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

type EnqueueEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
};

@Injectable()
export class OutboxService {
  async enqueue(tx: TxClient, input: EnqueueEventInput) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload,
      },
    });
  }
}
