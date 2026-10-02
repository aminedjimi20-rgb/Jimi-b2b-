-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "rc" TEXT,
ADD COLUMN     "nif" TEXT,
ADD COLUMN     "nis" TEXT,
ADD COLUMN     "ai" TEXT;

-- AlterTable
ALTER TABLE "registration_requests" ADD COLUMN     "rc" TEXT,
ADD COLUMN     "nif" TEXT,
ADD COLUMN     "nis" TEXT,
ADD COLUMN     "ai" TEXT;
