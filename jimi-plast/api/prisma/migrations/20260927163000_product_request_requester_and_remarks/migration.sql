-- AlterTable: add requestedById, backfill from the existing customer link, then make it required
ALTER TABLE "product_requests" ADD COLUMN "requestedById" TEXT;

UPDATE "product_requests" pr
SET "requestedById" = c."userId"
FROM "customers" c
WHERE c.id = pr."customerId";

ALTER TABLE "product_requests" ALTER COLUMN "requestedById" SET NOT NULL;

-- Drop the old customer-only link
ALTER TABLE "product_requests" DROP CONSTRAINT "product_requests_customerId_fkey";
ALTER TABLE "product_requests" DROP COLUMN "customerId";

-- AddForeignKey
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: soft-delete support (Trash-restorable, like Product/Category/Manufacturer)
ALTER TABLE "product_requests" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "product_request_remarks" (
    "id" TEXT NOT NULL,
    "productRequestId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "product_request_remarks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_request_remarks_productRequestId_idx" ON "product_request_remarks"("productRequestId");

ALTER TABLE "product_request_remarks" ADD CONSTRAINT "product_request_remarks_productRequestId_fkey" FOREIGN KEY ("productRequestId") REFERENCES "product_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
