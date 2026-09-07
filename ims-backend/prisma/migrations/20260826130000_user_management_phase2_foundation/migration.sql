-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- AlterTable
ALTER TABLE "users"
ADD COLUMN     "account_status" "AccountStatus",
ADD COLUMN     "phone" VARCHAR(32),
ALTER COLUMN   "password_hash" DROP NOT NULL;

-- Backfill account status from the legacy compatibility field.
UPDATE "users"
SET "account_status" = CASE
    WHEN "is_active" THEN 'ACTIVE'::"AccountStatus"
    ELSE 'INACTIVE'::"AccountStatus"
END
WHERE "account_status" IS NULL;

ALTER TABLE "users"
ALTER COLUMN "account_status" SET DEFAULT 'ACTIVE',
ALTER COLUMN "account_status" SET NOT NULL;

-- CreateIndex
CREATE INDEX "users_account_status_idx" ON "users"("account_status");

-- CreateIndex
CREATE INDEX "users_role_account_status_idx" ON "users"("role", "account_status");
