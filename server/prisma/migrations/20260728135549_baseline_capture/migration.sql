-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN     "completedBaselines" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalBaselines" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "baseline_responses" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "status" INTEGER,
    "latencyMs" INTEGER,
    "bodyLength" INTEGER,
    "bodySnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baseline_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "baseline_responses_testRunId_idx" ON "baseline_responses"("testRunId");

-- CreateIndex
CREATE UNIQUE INDEX "baseline_responses_testRunId_endpointId_key" ON "baseline_responses"("testRunId", "endpointId");

-- AddForeignKey
ALTER TABLE "baseline_responses" ADD CONSTRAINT "baseline_responses_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_responses" ADD CONSTRAINT "baseline_responses_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "target_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

