-- AlterTable
ALTER TABLE "attack_logs" ADD COLUMN     "identityId" TEXT;

-- AlterTable
ALTER TABLE "baseline_responses" ADD COLUMN     "identityId" TEXT;

-- CreateTable
CREATE TABLE "run_identities" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "authRecipeId" TEXT,
    "label" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_identities_testRunId_idx" ON "run_identities"("testRunId");

-- CreateIndex
CREATE UNIQUE INDEX "run_identities_testRunId_label_key" ON "run_identities"("testRunId", "label");

-- CreateIndex
CREATE INDEX "attack_logs_identityId_idx" ON "attack_logs"("identityId");

-- AddForeignKey
ALTER TABLE "run_identities" ADD CONSTRAINT "run_identities_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_identities" ADD CONSTRAINT "run_identities_authRecipeId_fkey" FOREIGN KEY ("authRecipeId") REFERENCES "auth_recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_responses" ADD CONSTRAINT "baseline_responses_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "run_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attack_logs" ADD CONSTRAINT "attack_logs_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "run_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
