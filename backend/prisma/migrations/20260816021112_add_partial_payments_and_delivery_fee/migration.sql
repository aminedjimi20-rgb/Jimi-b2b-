/*
  Warnings:

  - You are about to drop the column `estPayee` on the `Order` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_clientId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "estPayee",
ADD COLUMN     "fraisLivraison" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "montantPaye" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "fabricantId" TEXT,
ADD COLUMN     "stockReceiptId" TEXT,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StockReceipt" ADD COLUMN     "montantPaye" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Payment_fabricantId_idx" ON "Payment"("fabricantId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fabricantId_fkey" FOREIGN KEY ("fabricantId") REFERENCES "Fabricant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_stockReceiptId_fkey" FOREIGN KEY ("stockReceiptId") REFERENCES "StockReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
