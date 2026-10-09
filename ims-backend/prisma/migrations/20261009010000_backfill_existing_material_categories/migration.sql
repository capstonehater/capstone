-- Preserve explicit selections and add every category already using each
-- material in a product recipe or a product's modifier recipe.
BEGIN;
INSERT INTO "_RawMaterialCategories" ("A", "B")
SELECT DISTINCT product."category_id", recipe."raw_material_id"
FROM "variant_recipe_items" recipe
JOIN "product_variants" variant ON variant."id" = recipe."product_variant_id"
JOIN "products" product ON product."id" = variant."product_id"
UNION
SELECT DISTINCT product."category_id", adjustment."raw_material_id"
FROM "modifier_recipe_adjustments" adjustment
JOIN "modifiers" modifier ON modifier."id" = adjustment."modifier_id"
JOIN "product_modifier_groups" assignment ON assignment."modifier_group_id" = modifier."modifier_group_id"
JOIN "products" product ON product."id" = assignment."product_id"
ON CONFLICT ("A", "B") DO NOTHING;
COMMIT;
