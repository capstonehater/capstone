-- Prisma 6 uses a composite primary key for implicit many-to-many relations.
ALTER TABLE "_RawMaterialCategories"
  ADD CONSTRAINT "_RawMaterialCategories_AB_pkey"
  PRIMARY KEY USING INDEX "_RawMaterialCategories_AB_unique";

-- Prisma supplies @updatedAt; the schema does not declare a database default.
ALTER TABLE "forecast_settings" ALTER COLUMN "updated_at" DROP DEFAULT;
