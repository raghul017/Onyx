-- AlterTable
ALTER TABLE "target_endpoints" ADD COLUMN     "authRequirements" JSONB;

-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN     "authRecipeId" TEXT;

-- CreateTable
CREATE TABLE "auth_recipes" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "meta" JSONB NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_recipes_userId_idx" ON "auth_recipes"("userId");

-- CreateIndex
CREATE INDEX "auth_recipes_orgId_idx" ON "auth_recipes"("orgId");

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_authRecipeId_fkey" FOREIGN KEY ("authRecipeId") REFERENCES "auth_recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_recipes" ADD CONSTRAINT "auth_recipes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_recipes" ADD CONSTRAINT "auth_recipes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

