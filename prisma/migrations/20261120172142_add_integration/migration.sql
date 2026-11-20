-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('ATLASSIAN');

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_billingAccountId_provider_key" ON "Integration"("billingAccountId", "provider");
