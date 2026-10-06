-- Keep historical order snapshots after removing catalog variants.
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_variant_id_fkey";
ALTER TABLE "order_items" ALTER COLUMN "product_variant_id" DROP NOT NULL;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_fkey"
FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
