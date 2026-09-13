-- CreateEnum
CREATE TYPE "ProductRequestStatus" AS ENUM ('NEW', 'SEARCHING', 'FOUND', 'ORDERED', 'AVAILABLE', 'REFUSED');

-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED');

-- CreateTable
CREATE TABLE "product_requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "quantityWanted" INTEGER,
    "status" "ProductRequestStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiations" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currentPrice" DECIMAL(12,2) NOT NULL,
    "requestedPrice" DECIMAL(12,2) NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "status" "NegotiationStatus" NOT NULL DEFAULT 'PENDING',
    "counterPrice" DECIMAL(12,2),
    "validUntil" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "negotiations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
