-- CreateTable
CREATE TABLE "voucher_attachments" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voucher_attachments_voucherId_idx" ON "voucher_attachments"("voucherId");

-- AddForeignKey
ALTER TABLE "voucher_attachments" ADD CONSTRAINT "voucher_attachments_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "sales_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
