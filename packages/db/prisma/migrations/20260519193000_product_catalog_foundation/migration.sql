-- Product catalog quality fields for Practical V1.
ALTER TABLE "Product" ADD COLUMN "brand" TEXT;
ALTER TABLE "Product" ADD COLUMN "size" TEXT;
ALTER TABLE "Product" ADD COLUMN "unit" TEXT;
ALTER TABLE "Product" ADD COLUMN "importSource" TEXT;
ALTER TABLE "Product" ADD COLUMN "lastImportedAt" TIMESTAMP(3);

CREATE INDEX "Product_storeId_sku_idx" ON "Product"("storeId", "sku");
CREATE INDEX "Product_storeId_brand_idx" ON "Product"("storeId", "brand");
