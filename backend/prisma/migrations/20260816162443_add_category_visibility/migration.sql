-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visibleToEmployee" BOOLEAN NOT NULL DEFAULT true;

