-- AlterTable
ALTER TABLE "attack_logs" ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3);
