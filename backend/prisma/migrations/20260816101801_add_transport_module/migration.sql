-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "destination" TEXT,
ADD COLUMN     "transporteurId" TEXT;

-- CreateTable
CREATE TABLE "Transporteur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transporteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRate" (
    "id" TEXT NOT NULL,
    "transporteurId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "prix" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "DeliveryRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transporteur_nom_idx" ON "Transporteur"("nom");

-- CreateIndex
CREATE INDEX "Transporteur_deletedAt_idx" ON "Transporteur"("deletedAt");

-- CreateIndex
CREATE INDEX "DeliveryRate_transporteurId_idx" ON "DeliveryRate"("transporteurId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRate_transporteurId_destination_key" ON "DeliveryRate"("transporteurId", "destination");

-- AddForeignKey
ALTER TABLE "DeliveryRate" ADD CONSTRAINT "DeliveryRate_transporteurId_fkey" FOREIGN KEY ("transporteurId") REFERENCES "Transporteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_transporteurId_fkey" FOREIGN KEY ("transporteurId") REFERENCES "Transporteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
