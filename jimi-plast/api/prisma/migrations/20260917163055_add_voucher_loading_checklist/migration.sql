-- AlterTable
ALTER TABLE "sales_voucher_items" ADD COLUMN     "isLoaded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sales_vouchers" ADD COLUMN     "loadedById" TEXT;
