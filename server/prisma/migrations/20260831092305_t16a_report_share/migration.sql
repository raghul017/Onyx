-- CreateTable
CREATE TABLE "report_shares" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "report_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_shares_token_key" ON "report_shares"("token");

-- CreateIndex
CREATE INDEX "report_shares_testRunId_idx" ON "report_shares"("testRunId");

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
