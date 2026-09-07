BEGIN READ ONLY;
SELECT
  (SELECT COUNT(*) FROM product_variants pv LEFT JOIN variant_availability_summaries vas ON vas.product_variant_id = pv.id WHERE vas.product_variant_id IS NULL) AS variants_missing_summary,
  (SELECT COUNT(*) FROM product_variants pv LEFT JOIN variant_recipe_items vri ON vri.product_variant_id = pv.id WHERE vri.id IS NULL) AS variants_without_recipe_items,
  (SELECT COUNT(*) FROM products p LEFT JOIN product_variants pv ON pv.product_id = p.id WHERE pv.id IS NULL) AS products_without_variants,
  (SELECT COUNT(*) FROM stockout_events WHERE product_variant_id IS NOT NULL) AS product_variant_stockout_events,
  (SELECT COUNT(*) FROM stockout_events WHERE raw_material_id IS NOT NULL) AS raw_material_stockout_events,
  (SELECT COUNT(*) FROM variant_availability_events WHERE previous_is_sellable IS NULL) AS availability_events_initial_state_rows;
COMMIT;
