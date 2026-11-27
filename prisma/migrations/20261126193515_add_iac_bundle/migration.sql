-- CreateEnum
CREATE TYPE "IacFormat" AS ENUM ('TERRAFORM', 'BICEP');

-- CreateTable
CREATE TABLE "IacBundle" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "format" "IacFormat" NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IacBundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IacBundle_projectId_createdAt_idx" ON "IacBundle"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "IacBundle" ADD CONSTRAINT "IacBundle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
