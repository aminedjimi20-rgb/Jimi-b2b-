-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('NEW', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnDecision" AS ENUM ('REFUND', 'CREDIT_NOTE', 'DEDUCT_NEXT', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "ReturnItemCondition" AS ENUM ('DAMAGED', 'DEFECTIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('TO_PREPARE', 'PREPARED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED', 'PROBLEM');

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "number" TEXT,
    "type" "ReturnType" NOT NULL,
    "customerId" TEXT,
    "manufacturerId" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'NEW',
    "decision" "ReturnDecision",
    "totalValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "condition" "ReturnItemCondition" NOT NULL DEFAULT 'DAMAGED',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "driverName" TEXT,
    "vehicle" TEXT,
    "driverPhone" TEXT,
    "address" TEXT,
    "wilaya" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'TO_PREPARE',
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "billedToCustomer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "returns_number_key" ON "returns"("number");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_voucherId_key" ON "deliveries"("voucherId");

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "sales_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
