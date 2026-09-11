ALTER TABLE "Plan"
  ADD COLUMN "maxCashiers" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxRegisters" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "monthlyReceipts" INTEGER NOT NULL DEFAULT 300;

ALTER TABLE "Subscription"
  RENAME COLUMN "currentStart" TO "currentPeriodStart";
ALTER TABLE "Subscription"
  RENAME COLUMN "currentEnd" TO "currentPeriodEnd";
ALTER TABLE "Subscription"
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
