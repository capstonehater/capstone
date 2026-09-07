ALTER TYPE "InventorySourceType" ADD VALUE IF NOT EXISTS 'WASTE';

ALTER TABLE "inventory_transactions"
ADD COLUMN IF NOT EXISTS "reason_code" TEXT,
ADD COLUMN IF NOT EXISTS "metadata" JSONB;
