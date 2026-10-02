-- CreateEnum
CREATE TYPE "SupplierLedgerEntryType" AS ENUM ('PURCHASE_VOUCHER', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PurchaseVoucherStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "wilaya" TEXT,
    "contactName" TEXT,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ledger_entries" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "type" "SupplierLedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_vouchers" (
    "id" TEXT NOT NULL,
    "number" TEXT,
    "manufacturerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" "PurchaseVoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transportCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousDebt" DECIMAL(12,2),
    "notes" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_voucher_items" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packagingUnitId" TEXT NOT NULL,
    "quantityPackages" INTEGER NOT NULL,
    "unitsPerPackageSnapshot" INTEGER NOT NULL,
    "totalUnits" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_voucher_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_ledger_entries_manufacturerId_idx" ON "supplier_ledger_entries"("manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_vouchers_number_key" ON "purchase_vouchers"("number");

-- CreateIndex
CREATE INDEX "purchase_vouchers_manufacturerId_idx" ON "purchase_vouchers"("manufacturerId");

-- CreateIndex
CREATE INDEX "purchase_vouchers_status_idx" ON "purchase_vouchers"("status");

-- AddForeignKey
ALTER TABLE "supplier_ledger_entries" ADD CONSTRAINT "supplier_ledger_entries_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_vouchers" ADD CONSTRAINT "purchase_vouchers_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_vouchers" ADD CONSTRAINT "purchase_vouchers_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_voucher_items" ADD CONSTRAINT "purchase_voucher_items_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "purchase_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_voucher_items" ADD CONSTRAINT "purchase_voucher_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_voucher_items" ADD CONSTRAINT "purchase_voucher_items_packagingUnitId_fkey" FOREIGN KEY ("packagingUnitId") REFERENCES "packaging_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
