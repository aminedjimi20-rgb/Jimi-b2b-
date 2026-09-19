-- AlterTable
ALTER TABLE "manufacturers" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "pending_deletions" ADD COLUMN     "manufacturerId" TEXT,
ADD COLUMN     "supplierLedgerEntryId" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "registration_requests" ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "supplier_ledger_entries" ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_userId_key" ON "manufacturers"("userId");

-- CreateIndex
CREATE INDEX "pending_deletions_manufacturerId_idx" ON "pending_deletions"("manufacturerId");

-- CreateIndex
CREATE INDEX "pending_deletions_supplierLedgerEntryId_idx" ON "pending_deletions"("supplierLedgerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- AddForeignKey
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_supplierLedgerEntryId_fkey" FOREIGN KEY ("supplierLedgerEntryId") REFERENCES "supplier_ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

