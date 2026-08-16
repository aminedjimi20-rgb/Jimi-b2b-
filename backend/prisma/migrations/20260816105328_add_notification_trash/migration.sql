-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_userId_deletedAt_idx" ON "Notification"("userId", "deletedAt");
