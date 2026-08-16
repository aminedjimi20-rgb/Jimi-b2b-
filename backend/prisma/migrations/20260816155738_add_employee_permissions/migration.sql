-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "canSeeClientAddress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canSeeClientPhone" BOOLEAN NOT NULL DEFAULT false;

