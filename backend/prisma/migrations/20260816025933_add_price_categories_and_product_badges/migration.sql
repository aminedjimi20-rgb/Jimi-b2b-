-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "priceCategoryId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "estNouveau" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estSaisonnier" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PriceCategory" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSalePrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceCategoryId" TEXT NOT NULL,
    "prix" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ProductSalePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "prixAchat" DECIMAL(12,2) NOT NULL,
    "prixVente" DECIMAL(12,2) NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceCategory_nom_key" ON "PriceCategory"("nom");

-- CreateIndex
CREATE INDEX "ProductSalePrice_productId_idx" ON "ProductSalePrice"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSalePrice_productId_priceCategoryId_key" ON "ProductSalePrice"("productId", "priceCategoryId");

-- CreateIndex
CREATE INDEX "ProductPriceHistory_productId_idx" ON "ProductPriceHistory"("productId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_priceCategoryId_fkey" FOREIGN KEY ("priceCategoryId") REFERENCES "PriceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSalePrice" ADD CONSTRAINT "ProductSalePrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSalePrice" ADD CONSTRAINT "ProductSalePrice_priceCategoryId_fkey" FOREIGN KEY ("priceCategoryId") REFERENCES "PriceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
