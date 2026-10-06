export const HISTORY_REVERSAL_REASON = 'HISTORY_DELETION_REVERSAL';

export function historyStockWasReversed(metadata: unknown): boolean {
  return typeof metadata === 'object' && metadata !== null &&
    'historyStockReversed' in metadata && metadata.historyStockReversed === true;
}
