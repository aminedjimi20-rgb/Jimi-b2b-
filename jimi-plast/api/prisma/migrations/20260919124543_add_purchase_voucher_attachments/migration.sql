-- CreateTable
CREATE TABLE "purchase_voucher_attachments" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_voucher_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_voucher_attachments_voucherId_idx" ON "purchase_voucher_attachments"("voucherId");

-- AddForeignKey
ALTER TABLE "purchase_voucher_attachments" ADD CONSTRAINT "purchase_voucher_attachments_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "purchase_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

