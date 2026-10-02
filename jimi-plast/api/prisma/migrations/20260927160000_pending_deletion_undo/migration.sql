-- AlterEnum
ALTER TYPE "PendingDeletionStatus" ADD VALUE 'UNDONE';

-- AlterTable
ALTER TABLE "pending_deletions" ADD COLUMN "undoneById" TEXT;
ALTER TABLE "pending_deletions" ADD COLUMN "undoneAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_undoneById_fkey" FOREIGN KEY ("undoneById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
