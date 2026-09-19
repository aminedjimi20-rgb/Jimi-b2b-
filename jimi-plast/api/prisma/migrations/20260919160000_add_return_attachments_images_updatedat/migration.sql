-- AlterTable
ALTER TABLE "returns" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "return_attachments" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_item_images" (
    "id" TEXT NOT NULL,
    "returnItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_item_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_attachments_returnId_idx" ON "return_attachments"("returnId");

-- CreateIndex
CREATE INDEX "return_item_images_returnItemId_idx" ON "return_item_images"("returnItemId");

-- AddForeignKey
ALTER TABLE "return_attachments" ADD CONSTRAINT "return_attachments_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_item_images" ADD CONSTRAINT "return_item_images_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "return_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
