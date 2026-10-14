-- These match reporting date predicates and transaction-history pagination.
-- Prisma sends this multi-statement migration in one transaction.
CREATE INDEX "orders_status_completed_at_id_idx"
  ON "orders" ("status", "completed_at", "id");

CREATE INDEX "orders_completed_at_id_idx"
  ON "orders" ("completed_at", "id");
