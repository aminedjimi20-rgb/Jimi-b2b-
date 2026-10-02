-- CreateTable
CREATE TABLE "partner_logos" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_logos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_branding" (
    "id" TEXT NOT NULL,
    "experienceYears" INTEGER NOT NULL DEFAULT 35,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_branding_pkey" PRIMARY KEY ("id")
);
