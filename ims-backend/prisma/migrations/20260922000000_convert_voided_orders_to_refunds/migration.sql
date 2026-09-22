-- Reclassify existing completed-order voids without replaying their stock returns.
-- Keep original classification/reason in metadata for historical traceability.
UPDATE "inventory_transactions" AS t
SET "type" = 'REFUND', "source_type" = 'ORDER_REFUND',
    "metadata" = COALESCE(t."metadata", '{}'::jsonb) || jsonb_build_object(
      'originalReversalType', 'VOID', 'originalReasonCode', t."reason_code",
      'reversalType', 'REFUND', 'reclassifiedAt', CURRENT_TIMESTAMP),
    "reason_code" = CASE WHEN t."reason_code" = 'VOID_APPROVED' THEN 'CUSTOMER_REFUND' ELSE t."reason_code" END
WHERE t."source_type" = 'ORDER_VOID'
  AND t."source_id" IN (SELECT "id" FROM "order_reversals" WHERE "type" = 'VOID');

UPDATE "order_reversals"
SET "type" = 'REFUND',
    "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object(
      'originalReversalType', 'VOID', 'originalReasonCode', "reason_code",
      'reclassifiedAt', CURRENT_TIMESTAMP),
    "reason_code" = CASE WHEN "reason_code" = 'VOID_APPROVED' THEN 'CUSTOMER_REFUND' ELSE "reason_code" END
WHERE "type" = 'VOID';

UPDATE "orders" SET "status" = 'REFUNDED' WHERE "status" = 'VOIDED';
