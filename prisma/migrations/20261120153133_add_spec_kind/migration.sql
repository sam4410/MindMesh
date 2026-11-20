-- CreateEnum
CREATE TYPE "SpecKind" AS ENUM ('SPEC', 'ADR');

-- AlterTable
ALTER TABLE "ProjectSpec" ADD COLUMN     "kind" "SpecKind" NOT NULL DEFAULT 'SPEC';
