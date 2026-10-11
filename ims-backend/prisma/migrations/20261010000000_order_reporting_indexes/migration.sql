-- These match reporting date predicates and transaction-history pagination.
-- Concurrent builds keep checkout writes available during index creation.
-- Do not wrap this migration in a transaction.
CREATE INDEX CONCURRENTLY "orders_status_completed_at_id_idx"
  ON "orders" ("status", "completed_at", "id");

CREATE INDEX CONCURRENTLY "orders_completed_at_id_idx"
  ON "orders" ("completed_at", "id");
