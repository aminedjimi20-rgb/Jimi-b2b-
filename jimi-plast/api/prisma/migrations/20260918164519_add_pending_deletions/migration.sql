-- CreateEnum
CREATE TYPE "PendingDeletionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "pending_deletions" (
    "id" TEXT NOT NULL,
    "ledgerEntryId" TEXT,
    "salesVoucherId" TEXT,
    "customerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PendingDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_deletions_customerId_idx" ON "pending_deletions"("customerId");

-- CreateIndex
CREATE INDEX "pending_deletions_ledgerEntryId_idx" ON "pending_deletions"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "pending_deletions_salesVoucherId_idx" ON "pending_deletions"("salesVoucherId");

-- AddForeignKey
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_salesVoucherId_fkey" FOREIGN KEY ("salesVoucherId") REFERENCES "sales_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
