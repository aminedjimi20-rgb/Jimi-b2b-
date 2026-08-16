-- CreateEnum
CREATE TYPE "StockReceiptStatus" AS ENUM ('BROUILLON', 'CONFIRMEE', 'ANNULEE');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "canCreateBonEntree" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreerFournisseur" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreerProduit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canModifierBonApresConfirmation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canModifierPrixAchat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canModifierProduit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canVoirPrixVente" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockReceipt" ADD COLUMN     "destination" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "fraisLivraison" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "numeroBonFournisseur" TEXT,
ADD COLUMN     "status" "StockReceiptStatus" NOT NULL DEFAULT 'CONFIRMEE',
ADD COLUMN     "transporteurId" TEXT;

-- CreateTable
CREATE TABLE "StockReceiptChangeLog" (
    "id" TEXT NOT NULL,
    "stockReceiptId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReceiptChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockReceiptChangeLog_stockReceiptId_idx" ON "StockReceiptChangeLog"("stockReceiptId");

-- CreateIndex
CREATE INDEX "StockReceipt_employeeId_idx" ON "StockReceipt"("employeeId");

-- CreateIndex
CREATE INDEX "StockReceipt_status_idx" ON "StockReceipt"("status");

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_transporteurId_fkey" FOREIGN KEY ("transporteurId") REFERENCES "Transporteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptChangeLog" ADD CONSTRAINT "StockReceiptChangeLog_stockReceiptId_fkey" FOREIGN KEY ("stockReceiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
