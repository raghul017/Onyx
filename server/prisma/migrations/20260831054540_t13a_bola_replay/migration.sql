-- AlterTable
ALTER TABLE "attack_logs" ADD COLUMN     "bolaObjectId" TEXT,
ADD COLUMN     "bolaSourceIdentityId" TEXT;

-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN     "completedReplays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalReplays" INTEGER NOT NULL DEFAULT 0;
