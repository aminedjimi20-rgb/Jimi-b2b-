-- AlterTable
ALTER TABLE "pending_deletions" ADD COLUMN     "purchaseVoucherId" TEXT;

-- AlterTable
ALTER TABLE "purchase_voucher_items" ADD COLUMN     "modifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "pending_deletions_purchaseVoucherId_idx" ON "pending_deletions"("purchaseVoucherId");

-- AddForeignKey
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_purchaseVoucherId_fkey" FOREIGN KEY ("purchaseVoucherId") REFERENCES "purchase_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

