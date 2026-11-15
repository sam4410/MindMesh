-- CreateTable
CREATE TABLE "DesignResearch" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignResearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesignResearch_cacheKey_key" ON "DesignResearch"("cacheKey");
