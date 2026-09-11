/*
  Warnings:

  - A unique constraint covering the columns `[code,productId]` on the table `Barcode` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `CashSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- DropIndex
DROP INDEX "Barcode_code_key";

-- DropIndex
DROP INDEX "Product_sku_key";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "tenantId" TEXT;

-- AlterTable (add nullable first, then backfill, then make NOT NULL)
ALTER TABLE "CashSession" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "priceYearly" INTEGER NOT NULL DEFAULT 0,
    "maxBranches" INTEGER NOT NULL DEFAULT 1,
    "maxUsers" INTEGER NOT NULL DEFAULT 2,
    "maxProducts" INTEGER NOT NULL DEFAULT 100,
    "maxReceipts" INTEGER NOT NULL DEFAULT 500,
    "storageMB" INTEGER NOT NULL DEFAULT 100,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "currentStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Barcode_code_productId_key" ON "Barcode"("code", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");

-- ======== BACKFILL: create default tenant & plan, assign existing data ========

-- Insert default FREE plan
INSERT INTO "Plan" ("id", "name", "displayName", "priceMonthly", "priceYearly", "maxBranches", "maxUsers", "maxProducts", "maxReceipts", "storageMB", "features", "isActive", "sortOrder", "createdAt")
VALUES ('plan_free', 'FREE', 'Bepul', 0, 0, 1, 1, 100, 500, 100, '{"loyalty": false, "advancedReports": false}', true, 0, NOW());

-- Insert default tenant for existing data
INSERT INTO "Tenant" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES ('tenant_default', 'Demo Do''kon', 'demo-dokon', true, NOW(), NOW());

-- Create default branch
INSERT INTO "Branch" ("id", "tenantId", "name", "isActive", "createdAt")
VALUES ('branch_default', 'tenant_default', 'Asosiy filial', true, NOW());

-- Subscribe default tenant to FREE plan
INSERT INTO "Subscription" ("id", "tenantId", "planId", "status", "trialEndsAt", "currentStart", "createdAt", "updatedAt")
VALUES ('sub_default', 'tenant_default', 'plan_free', 'ACTIVE', NULL, NOW(), NOW(), NOW());

-- Backfill existing rows
UPDATE "User" SET "tenantId" = 'tenant_default', "branchId" = 'branch_default' WHERE "tenantId" IS NULL;
UPDATE "Product" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "Sale" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "CashSession" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "AuditLog" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;

-- Make admin user an OWNER (use raw SQL UPDATE since enum was just added)
-- Note: role column will be updated by seed.ts after migration

-- Now make required columns NOT NULL
ALTER TABLE "Product" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CashSession" ALTER COLUMN "tenantId" SET NOT NULL;

-- ======== END BACKFILL ========

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
