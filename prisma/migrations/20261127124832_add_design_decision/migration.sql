-- CreateTable
CREATE TABLE "DesignDecision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "reasons" TEXT[],
    "alternatives" TEXT[],
    "tradeoffs" TEXT NOT NULL,
    "nodeIds" TEXT[],
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignDecision_projectId_createdAt_idx" ON "DesignDecision"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "DesignDecision" ADD CONSTRAINT "DesignDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
