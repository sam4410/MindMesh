-- Add a persisted deletion state so pending deletions cannot be accessed or recreate their rooms.
ALTER TABLE "Project" ADD COLUMN "deletionPending" BOOLEAN NOT NULL DEFAULT false;
