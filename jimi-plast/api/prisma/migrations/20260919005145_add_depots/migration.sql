-- CreateTable
CREATE TABLE "depots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "depots_name_key" ON "depots"("name");

-- Dépôts par défaut, pour ne rien perdre de ce qui existait déjà en dur côté front.
INSERT INTO "depots" ("id", "name", "sortOrder") VALUES
  ('depot-seed-1', 'Dépôt 1', 0),
  ('depot-seed-2', 'Dépôt 2', 1),
  ('depot-seed-3', 'Dépôt 3', 2)
ON CONFLICT ("name") DO NOTHING;

