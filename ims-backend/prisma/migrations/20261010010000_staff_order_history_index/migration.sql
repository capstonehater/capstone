-- Staff history filters by cashier and sorts by completed_at, id.
-- Do not wrap this migration in a transaction.
CREATE INDEX CONCURRENTLY "orders_created_by_user_id_completed_at_id_idx"
  ON "orders" ("created_by_user_id", "completed_at", "id");
