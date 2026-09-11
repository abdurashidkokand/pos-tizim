-- CreateEnum
CREATE TYPE "TgLinkEntityType" AS ENUM ('USER', 'CUSTOMER', 'OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "TgLinkSource" AS ENUM ('TOKEN', 'QR', 'PHONE_OTP', 'RECEIPT', 'MANUAL_ADMIN');

-- CreateEnum
CREATE TYPE "TgDeliveryMode" AS ENUM ('INSTANT', 'DIGEST', 'OFF');

-- CreateEnum
CREATE TYPE "TgAudience" AS ENUM ('OWNER', 'CUSTOMER', 'STAFF', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "TgParseMode" AS ENUM ('NONE', 'HTML', 'MARKDOWNV2');

-- CreateEnum
CREATE TYPE "TgNotifStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BLOCKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TgQueuePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TgQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryAlertType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'FAST_MOVING', 'DEAD_STOCK', 'OVERSTOCK', 'EXPIRY_SOON', 'INVENTORY_MISMATCH');

-- CreateTable
CREATE TABLE "TelegramBotConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "botTokenEncrypted" TEXT NOT NULL,
    "botUsername" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "miniAppUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
    "lastWebhookSetAt" TIMESTAMP(3),
    "lastHealthCheckAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramBotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramTenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "ownerNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customerBotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "staffBotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "miniAppEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deepLinkBaseUrl" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'uz',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "alertDailySummary" BOOLEAN NOT NULL DEFAULT true,
    "alertWeeklySummary" BOOLEAN NOT NULL DEFAULT false,
    "alertMonthlySummary" BOOLEAN NOT NULL DEFAULT false,
    "alertLowStock" BOOLEAN NOT NULL DEFAULT true,
    "alertOutOfStock" BOOLEAN NOT NULL DEFAULT true,
    "alertRefund" BOOLEAN NOT NULL DEFAULT true,
    "alertDebt" BOOLEAN NOT NULL DEFAULT true,
    "alertCashSession" BOOLEAN NOT NULL DEFAULT true,
    "alertLargeDiscount" BOOLEAN NOT NULL DEFAULT false,
    "alertInventoryMismatch" BOOLEAN NOT NULL DEFAULT false,
    "customerReceiptMessage" BOOLEAN NOT NULL DEFAULT true,
    "customerCashbackNotif" BOOLEAN NOT NULL DEFAULT true,
    "customerBonusExpiry" BOOLEAN NOT NULL DEFAULT true,
    "customerStampProgress" BOOLEAN NOT NULL DEFAULT true,
    "customerPromoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramTenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramIdentity" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "languageCode" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" TIMESTAMP(3),
    "lastDeliveryStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramIdentityId" TEXT NOT NULL,
    "entityType" "TgLinkEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "linkSource" "TgLinkSource" NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "linkedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "entityType" "TgLinkEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "intendedRole" "Role",
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByTelegramIdentityId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramNotificationPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "TgLinkEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "telegramIdentityId" TEXT,
    "notificationType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryMode" "TgDeliveryMode" NOT NULL DEFAULT 'INSTANT',
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramMessageTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "code" TEXT NOT NULL,
    "audience" "TgAudience" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'uz',
    "titleTemplate" TEXT,
    "bodyTemplate" TEXT NOT NULL,
    "parseMode" "TgParseMode" NOT NULL DEFAULT 'HTML',
    "inlineKeyboardJson" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramNotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "telegramIdentityId" TEXT,
    "notificationType" TEXT NOT NULL,
    "audience" "TgAudience" NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "templateCode" TEXT,
    "payloadJson" JSONB,
    "messageTextSnapshot" TEXT,
    "telegramMessageId" TEXT,
    "status" "TgNotifStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramNotificationQueue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "notificationType" TEXT NOT NULL,
    "audience" "TgAudience" NOT NULL,
    "telegramIdentityId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT,
    "priority" "TgQueuePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TgQueueStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramNotificationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAlertRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "productId" TEXT,
    "alertType" "InventoryAlertType" NOT NULL,
    "minQuantity" INTEGER,
    "daysWithoutSale" INTEGER,
    "velocityWindowDays" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryAlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAlertSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramIdentityId" TEXT,
    "alertType" "InventoryAlertType" NOT NULL,
    "branchId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryAlertSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramTenantSettings_tenantId_key" ON "TelegramTenantSettings"("tenantId");
CREATE UNIQUE INDEX "TelegramIdentity_telegramUserId_key" ON "TelegramIdentity"("telegramUserId");
CREATE UNIQUE INDEX "TelegramLink_tenantId_entityType_entityId_key" ON "TelegramLink"("tenantId", "entityType", "entityId");
CREATE UNIQUE INDEX "TelegramLinkToken_tokenHash_key" ON "TelegramLinkToken"("tokenHash");
CREATE UNIQUE INDEX "TelegramNotificationPreference_tenantId_entityType_entityId_notificationType_key" ON "TelegramNotificationPreference"("tenantId", "entityType", "entityId", "notificationType");
CREATE UNIQUE INDEX "TelegramMessageTemplate_code_language_tenantId_key" ON "TelegramMessageTemplate"("code", "language", "tenantId");
CREATE INDEX "TelegramNotificationQueue_status_scheduledFor_idx" ON "TelegramNotificationQueue"("status", "scheduledFor");
CREATE INDEX "TelegramNotificationQueue_dedupeKey_idx" ON "TelegramNotificationQueue"("dedupeKey");

-- AddForeignKey
ALTER TABLE "TelegramTenantSettings" ADD CONSTRAINT "TelegramTenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_telegramIdentityId_fkey" FOREIGN KEY ("telegramIdentityId") REFERENCES "TelegramIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_usedByTelegramIdentityId_fkey" FOREIGN KEY ("usedByTelegramIdentityId") REFERENCES "TelegramIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramNotificationPreference" ADD CONSTRAINT "TelegramNotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramNotificationPreference" ADD CONSTRAINT "TelegramNotificationPreference_telegramIdentityId_fkey" FOREIGN KEY ("telegramIdentityId") REFERENCES "TelegramIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramNotificationLog" ADD CONSTRAINT "TelegramNotificationLog_telegramIdentityId_fkey" FOREIGN KEY ("telegramIdentityId") REFERENCES "TelegramIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramNotificationQueue" ADD CONSTRAINT "TelegramNotificationQueue_telegramIdentityId_fkey" FOREIGN KEY ("telegramIdentityId") REFERENCES "TelegramIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryAlertRule" ADD CONSTRAINT "InventoryAlertRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAlertSubscription" ADD CONSTRAINT "InventoryAlertSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
