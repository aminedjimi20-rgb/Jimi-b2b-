-- CreateTable
CREATE TABLE "besoins" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "response" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "besoins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "besoins_authorId_idx" ON "besoins"("authorId");

-- AddForeignKey
ALTER TABLE "besoins" ADD CONSTRAINT "besoins_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "besoins" ADD CONSTRAINT "besoins_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
