-- AddForeignKey
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
