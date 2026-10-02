-- Remplace la note générale unique (un seul champ, réécrit à chaque fois)
-- par un journal de remarques : chaque "OK" ajoute une entrée datée et
-- immuable, jamais une réécriture — seule une rature directe est permise
-- ensuite (voidedAt), sans workflow d'approbation puisque c'est une note
-- interne, jamais vue par le client/fabricant lui-même.

ALTER TABLE "customers" DROP COLUMN "notesHidden";
ALTER TABLE "manufacturers" DROP COLUMN "notesHidden";

CREATE TABLE "customer_remarks" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "customer_remarks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_remarks_customerId_idx" ON "customer_remarks"("customerId");

ALTER TABLE "customer_remarks" ADD CONSTRAINT "customer_remarks_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "manufacturer_remarks" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "manufacturer_remarks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manufacturer_remarks_manufacturerId_idx" ON "manufacturer_remarks"("manufacturerId");

ALTER TABLE "manufacturer_remarks" ADD CONSTRAINT "manufacturer_remarks_manufacturerId_fkey"
  FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
