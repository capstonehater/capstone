ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_price_non_negative"
  CHECK ("price" >= 0);

ALTER TABLE "modifiers"
  ADD CONSTRAINT "modifiers_price_adjustment_non_negative"
  CHECK ("price_adjustment" >= 0);

ALTER TABLE "raw_materials"
  ADD CONSTRAINT "raw_materials_reorder_point_non_negative"
  CHECK ("reorder_point" >= 0);

ALTER TABLE "variant_recipe_items"
  ADD CONSTRAINT "variant_recipe_items_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "stock_run_items"
  ADD CONSTRAINT "stock_run_items_quantity_positive"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "stock_run_items_cost_per_unit_positive"
  CHECK ("cost_per_unit" > 0);

ALTER TABLE "stock_batches"
  ADD CONSTRAINT "stock_batches_initial_quantity_non_negative"
  CHECK ("initial_quantity" >= 0),
  ADD CONSTRAINT "stock_batches_remaining_quantity_non_negative"
  CHECK ("remaining_quantity" >= 0),
  ADD CONSTRAINT "stock_batches_remaining_not_above_initial"
  CHECK ("remaining_quantity" <= "initial_quantity"),
  ADD CONSTRAINT "stock_batches_cost_per_unit_non_negative"
  CHECK ("cost_per_unit" >= 0);

ALTER TABLE "product_modifier_groups"
  ADD CONSTRAINT "product_modifier_groups_min_non_negative"
  CHECK ("min_select" >= 0),
  ADD CONSTRAINT "product_modifier_groups_max_positive"
  CHECK ("max_select" > 0),
  ADD CONSTRAINT "product_modifier_groups_min_not_above_max"
  CHECK ("min_select" <= "max_select");

ALTER TABLE "inventory_transaction_lines"
  ADD CONSTRAINT "inventory_transaction_lines_quantity_non_zero"
  CHECK ("quantity_delta" <> 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_subtotal_non_negative"
  CHECK ("subtotal_amount" >= 0),
  ADD CONSTRAINT "orders_discount_non_negative"
  CHECK ("discount_amount" >= 0),
  ADD CONSTRAINT "orders_tax_non_negative"
  CHECK ("tax_amount" >= 0),
  ADD CONSTRAINT "orders_total_non_negative"
  CHECK ("total_amount" >= 0),
  ADD CONSTRAINT "orders_total_cogs_non_negative"
  CHECK ("total_cogs_amount" >= 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_unit_base_non_negative"
  CHECK ("unit_base_price" >= 0),
  ADD CONSTRAINT "order_items_unit_modifier_non_negative"
  CHECK ("unit_modifier_amount" >= 0),
  ADD CONSTRAINT "order_items_unit_final_non_negative"
  CHECK ("unit_final_price" >= 0),
  ADD CONSTRAINT "order_items_line_subtotal_non_negative"
  CHECK ("line_subtotal" >= 0),
  ADD CONSTRAINT "order_items_unit_cogs_non_negative"
  CHECK ("unit_cogs_amount" >= 0),
  ADD CONSTRAINT "order_items_line_cogs_non_negative"
  CHECK ("line_cogs_amount" >= 0);

ALTER TABLE "order_item_modifiers"
  ADD CONSTRAINT "order_item_modifiers_quantity_positive"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_item_modifiers_unit_price_non_negative"
  CHECK ("unit_price_adjustment" >= 0),
  ADD CONSTRAINT "order_item_modifiers_line_total_non_negative"
  CHECK ("line_total" >= 0);

ALTER TABLE "order_payments"
  ADD CONSTRAINT "order_payments_amount_positive"
  CHECK ("amount" > 0);

CREATE INDEX IF NOT EXISTS "idx_stock_batches_open_fefo"
  ON "stock_batches" ("raw_material_id", "expiration_date", "received_at")
  WHERE "remaining_quantity" > 0;

CREATE INDEX IF NOT EXISTS "idx_outbox_events_pending"
  ON "outbox_events" ("status", "available_at")
  WHERE "status" IN ('PENDING', 'FAILED');
