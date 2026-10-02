-- Delivery: generalize to sales OR purchase voucher, add driver link + tracking fields
ALTER TABLE "deliveries" RENAME COLUMN "voucherId" TO "salesVoucherId";
ALTER TABLE "deliveries" ALTER COLUMN "salesVoucherId" DROP NOT NULL;
ALTER TABLE "deliveries" ADD COLUMN "purchaseVoucherId" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "driverId" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "billedToManufacturer" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "deliveries" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "createdById" TEXT;

CREATE UNIQUE INDEX "deliveries_purchaseVoucherId_key" ON "deliveries"("purchaseVoucherId");

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_purchaseVoucherId_fkey" FOREIGN KEY ("purchaseVoucherId") REFERENCES "purchase_vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drivers
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "vehicle" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Expense categories (admin-managed list, same principle as depots)
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- Expenses (general company costs, never billed to a customer/manufacturer)
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "deliveryId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "expenses_deliveryId_key" ON "expenses"("deliveryId");
CREATE INDEX "expenses_date_idx" ON "expenses"("date");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
