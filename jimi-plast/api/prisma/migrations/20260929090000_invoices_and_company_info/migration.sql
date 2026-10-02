-- AlterTable
ALTER TABLE "site_branding" ADD COLUMN     "companyLegalName" TEXT,
ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "companyPhone" TEXT,
ADD COLUMN     "companyRC" TEXT,
ADD COLUMN     "companyNIF" TEXT,
ADD COLUMN     "companyNIS" TEXT,
ADD COLUMN     "companyAI" TEXT;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_voucherId_key" ON "invoices"("voucherId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "sales_vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
