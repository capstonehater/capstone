BEGIN READ ONLY;
SELECT 'products' AS table_name, COUNT(*)::bigint AS row_count FROM products
UNION ALL SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL SELECT 'variant_recipe_items', COUNT(*) FROM variant_recipe_items
UNION ALL SELECT 'variant_availability_summaries', COUNT(*) FROM variant_availability_summaries
UNION ALL SELECT 'variant_availability_events', COUNT(*) FROM variant_availability_events
UNION ALL SELECT 'stockout_events', COUNT(*) FROM stockout_events
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'inventory_transactions', COUNT(*) FROM inventory_transactions
UNION ALL SELECT 'inventory_transaction_lines', COUNT(*) FROM inventory_transaction_lines
UNION ALL SELECT 'raw_materials', COUNT(*) FROM raw_materials
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'forecast_runs', COUNT(*) FROM forecast_runs
UNION ALL SELECT 'raw_material_demand_observations', COUNT(*) FROM raw_material_demand_observations
UNION ALL SELECT 'inventory_daily_snapshots', COUNT(*) FROM inventory_daily_snapshots
ORDER BY table_name;
SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('products','product_variants','variant_recipe_items','variant_availability_summaries','variant_availability_events','stockout_events','forecast_runs','raw_material_demand_observations','inventory_daily_snapshots') ORDER BY table_name, ordinal_position;
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('products','product_variants','variant_recipe_items','variant_availability_summaries','variant_availability_events','stockout_events','forecast_runs','raw_material_demand_observations','inventory_daily_snapshots') ORDER BY tablename, indexname;
SELECT
  (SELECT COUNT(*) FROM product_variants pv LEFT JOIN products p ON p.id = pv.product_id WHERE p.id IS NULL) AS orphan_variants,
  (SELECT COUNT(*) FROM variant_recipe_items vri LEFT JOIN product_variants pv ON pv.id = vri.product_variant_id WHERE pv.id IS NULL) AS orphan_recipe_variant_refs,
  (SELECT COUNT(*) FROM variant_recipe_items vri LEFT JOIN raw_materials rm ON rm.id = vri.raw_material_id WHERE rm.id IS NULL) AS orphan_recipe_material_refs,
  (SELECT COUNT(*) FROM order_items oi LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id WHERE pv.id IS NULL) AS orphan_order_item_variant_refs,
  (SELECT COUNT(*) FROM inventory_transaction_lines itl LEFT JOIN product_variants pv ON pv.id = itl.product_variant_id WHERE itl.product_variant_id IS NOT NULL AND pv.id IS NULL) AS orphan_ledger_variant_refs;
COMMIT;
