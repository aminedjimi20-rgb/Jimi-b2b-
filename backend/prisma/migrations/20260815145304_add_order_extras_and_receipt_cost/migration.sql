-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "estPayee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nom" TEXT,
ADD COLUMN     "remisePourcentage" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "StockReceipt" ADD COLUMN     "totalAchat" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockReceiptItem" ADD COLUMN     "prixAchat" DECIMAL(12,2) NOT NULL DEFAULT 0;
