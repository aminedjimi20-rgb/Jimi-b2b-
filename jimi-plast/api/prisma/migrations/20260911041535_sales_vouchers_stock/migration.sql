-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('SALE', 'SALE_CANCEL', 'PURCHASE', 'RETURN_CUSTOMER', 'RETURN_SUPPLIER', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "sales_vouchers" (
    "id" TEXT NOT NULL,
    "number" TEXT,
    "customerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transportCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousCredit" DECIMAL(12,2),
    "notes" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sales_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_voucher_items" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceTierTypeId" TEXT NOT NULL,
    "packagingUnitId" TEXT NOT NULL,
    "quantityPackages" INTEGER NOT NULL,
    "unitsPerPackageSnapshot" INTEGER NOT NULL,
    "totalUnits" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sales_voucher_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_vouchers_number_key" ON "sales_vouchers"("number");

-- CreateIndex
CREATE INDEX "sales_vouchers_customerId_idx" ON "sales_vouchers"("customerId");

-- CreateIndex
CREATE INDEX "sales_vouchers_status_idx" ON "sales_vouchers"("status");

-- CreateIndex
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");

-- AddForeignKey
ALTER TABLE "sales_vouchers" ADD CONSTRAINT "sales_vouchers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_vouchers" ADD CONSTRAINT "sales_vouchers_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_voucher_items" ADD CONSTRAINT "sales_voucher_items_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "sales_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_voucher_items" ADD CONSTRAINT "sales_voucher_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_voucher_items" ADD CONSTRAINT "sales_voucher_items_priceTierTypeId_fkey" FOREIGN KEY ("priceTierTypeId") REFERENCES "price_tier_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_voucher_items" ADD CONSTRAINT "sales_voucher_items_packagingUnitId_fkey" FOREIGN KEY ("packagingUnitId") REFERENCES "packaging_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
