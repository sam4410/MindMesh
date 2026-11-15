-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");
