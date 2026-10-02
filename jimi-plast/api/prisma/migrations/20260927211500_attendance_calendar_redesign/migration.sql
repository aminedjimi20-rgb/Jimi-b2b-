-- Pointage-calendrier : remplace le clock-in/clock-out par une case cochée
-- par l'employé (markedAt) et confirmée séparément par l'administrateur
-- (confirmedAt/confirmedById). Une seule ligne existante (test) — perte
-- acceptée, aucune donnée réelle en jeu.
TRUNCATE TABLE "attendances";

ALTER TABLE "attendances" DROP CONSTRAINT "attendances_userId_fkey";

ALTER TABLE "attendances"
  DROP COLUMN "clockInAt",
  DROP COLUMN "clockOutAt",
  ADD COLUMN "date" TEXT NOT NULL,
  ADD COLUMN "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedById" TEXT,
  ADD COLUMN "hiddenAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "attendances_userId_date_key" ON "attendances"("userId", "date");

ALTER TABLE "attendances" ADD CONSTRAINT "attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
