ALTER TYPE "InventoryTransactionType" ADD VALUE IF NOT EXISTS 'VOID';
ALTER TYPE "InventoryTransactionType" ADD VALUE IF NOT EXISTS 'REFUND';

ALTER TYPE "InventorySourceType" ADD VALUE IF NOT EXISTS 'ORDER_VOID';
ALTER TYPE "InventorySourceType" ADD VALUE IF NOT EXISTS 'ORDER_REFUND';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertType') THEN
    CREATE TYPE "AlertType" AS ENUM ('NEAR_EXPIRY', 'EXPIRED', 'LOW_STOCK');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertSeverity') THEN
    CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertState') THEN
    CREATE TYPE "AlertState" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'DISMISSED', 'RESOLVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderReversalType') THEN
    CREATE TYPE "OrderReversalType" AS ENUM ('VOID', 'REFUND');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "order_reversals" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "type" "OrderReversalType" NOT NULL,
  "reason_code" TEXT NOT NULL,
  "note" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "payment_reference" TEXT,
  "metadata" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "order_reversals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_reversals_order_id_key" ON "order_reversals"("order_id");
CREATE INDEX IF NOT EXISTS "order_reversals_actor_user_id_occurred_at_idx" ON "order_reversals"("actor_user_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "order_reversals_type_occurred_at_idx" ON "order_reversals"("type", "occurred_at");

ALTER TABLE "order_reversals"
ADD CONSTRAINT "order_reversals_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_reversals"
ADD CONSTRAINT "order_reversals_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "alerts" (
  "id" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "type" "AlertType" NOT NULL,
  "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
  "state" "AlertState" NOT NULL DEFAULT 'ACTIVE',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "raw_material_id" TEXT,
  "stock_batch_id" TEXT,
  "supplier_id" TEXT,
  "expiry_date" DATE,
  "remaining_quantity" DECIMAL(14,4),
  "metadata" JSONB,
  "first_triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMP(3),
  "acknowledged_by_user_id" TEXT,
  "dismissed_at" TIMESTAMP(3),
  "dismissed_by_user_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "alerts_dedupe_key_key" ON "alerts"("dedupe_key");
CREATE INDEX IF NOT EXISTS "alerts_state_severity_last_triggered_at_idx" ON "alerts"("state", "severity", "last_triggered_at");
CREATE INDEX IF NOT EXISTS "alerts_type_state_last_triggered_at_idx" ON "alerts"("type", "state", "last_triggered_at");
CREATE INDEX IF NOT EXISTS "alerts_raw_material_id_idx" ON "alerts"("raw_material_id");
CREATE INDEX IF NOT EXISTS "alerts_stock_batch_id_idx" ON "alerts"("stock_batch_id");

ALTER TABLE "alerts"
ADD CONSTRAINT "alerts_raw_material_id_fkey"
FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts"
ADD CONSTRAINT "alerts_stock_batch_id_fkey"
FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts"
ADD CONSTRAINT "alerts_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts"
ADD CONSTRAINT "alerts_acknowledged_by_user_id_fkey"
FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts"
ADD CONSTRAINT "alerts_dismissed_by_user_id_fkey"
FOREIGN KEY ("dismissed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
