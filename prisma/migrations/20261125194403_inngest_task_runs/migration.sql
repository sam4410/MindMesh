-- CreateEnum
CREATE TYPE "TaskRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "TaskRun" ADD COLUMN     "input" JSONB,
ADD COLUMN     "output" JSONB,
ADD COLUMN     "status" "TaskRunStatus" NOT NULL DEFAULT 'RUNNING';
