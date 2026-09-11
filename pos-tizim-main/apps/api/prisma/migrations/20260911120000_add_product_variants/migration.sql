-- Product variants own their barcode and available quantity. Existing products are
-- preserved by receiving one default variant carrying their current stock.
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "sku" TEXT,
    "price" INTEGER,
    "cost" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ProductVariant" ("id", "productId", "quantity", "createdAt", "updatedAt")
SELECT
    'pv_' || md5(p."id"),
    p."id",
    COALESCE(s."quantity", 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Product" p
LEFT JOIN "Stock" s ON s."productId" = p."id";

ALTER TABLE "Barcode" ADD COLUMN "variantId" TEXT;
UPDATE "Barcode" b
SET "variantId" = 'pv_' || md5(b."productId");
ALTER TABLE "Barcode" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_code_key" UNIQUE ("code");
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_variantId_key" UNIQUE ("variantId");

ALTER TABLE "StockMovement" ADD COLUMN "variantId" TEXT;
ALTER TABLE "StockMovement" ALTER COLUMN "stockId" DROP NOT NULL;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaleItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProductVariant_productId_size_color_key" ON "ProductVariant"("productId", "size", "color");
CREATE UNIQUE INDEX "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");
