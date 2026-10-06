ALTER TABLE "inventory_transactions"
ADD COLUMN "history_deleted_at" TIMESTAMP(3),
ADD COLUMN "history_deleted_by_user_id" TEXT;
