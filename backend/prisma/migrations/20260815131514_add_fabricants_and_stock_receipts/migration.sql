-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "fabricantId" TEXT,
ADD COLUMN     "uniteParCarton" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "stockReceiptId" TEXT;

-- CreateTable
CREATE TABLE "Fabricant" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fabricant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceipt" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "fabricantId" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceiptItem" (
    "id" TEXT NOT NULL,
    "stockReceiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cartons" INTEGER NOT NULL,
    "unitesParCarton" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixVente" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "StockReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fabricant_nom_idx" ON "Fabricant"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "StockReceipt_reference_key" ON "StockReceipt"("reference");

-- CreateIndex
CREATE INDEX "StockReceipt_fabricantId_idx" ON "StockReceipt"("fabricantId");

-- CreateIndex
CREATE INDEX "StockReceiptItem_stockReceiptId_idx" ON "StockReceiptItem"("stockReceiptId");

-- CreateIndex
CREATE INDEX "Product_fabricantId_idx" ON "Product"("fabricantId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_fabricantId_fkey" FOREIGN KEY ("fabricantId") REFERENCES "Fabricant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockReceiptId_fkey" FOREIGN KEY ("stockReceiptId") REFERENCES "StockReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_fabricantId_fkey" FOREIGN KEY ("fabricantId") REFERENCES "Fabricant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_stockReceiptId_fkey" FOREIGN KEY ("stockReceiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
