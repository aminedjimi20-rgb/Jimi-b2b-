-- CreateEnum
CREATE TYPE "ProductRequestStatus" AS ENUM ('EN_ATTENTE', 'TRAITEE', 'REJETEE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DEMANDE_PRODUIT';

-- CreateTable
CREATE TABLE "ProductRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductRequestStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "adminNote" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRequest_clientId_idx" ON "ProductRequest"("clientId");

-- CreateIndex
CREATE INDEX "ProductRequest_status_idx" ON "ProductRequest"("status");

-- CreateIndex
CREATE INDEX "ProductRequest_deletedAt_idx" ON "ProductRequest"("deletedAt");

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
