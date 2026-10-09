BEGIN;
CREATE TABLE "_RawMaterialCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_RawMaterialCategories_AB_unique" ON "_RawMaterialCategories"("A", "B");
CREATE INDEX "_RawMaterialCategories_B_index" ON "_RawMaterialCategories"("B");
ALTER TABLE "_RawMaterialCategories" ADD CONSTRAINT "_RawMaterialCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RawMaterialCategories" ADD CONSTRAINT "_RawMaterialCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
