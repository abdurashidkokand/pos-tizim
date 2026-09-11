import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../db/prisma.service';
import { TelegramNotificationsService } from '../notifications/telegram-notifications.service';
import { TelegramOwnerAlertsService } from '../owner-alerts/telegram-owner-alerts.service';
import { TgAudience } from '@prisma/client';

@Injectable()
export class TelegramSchedulerService {
  private readonly logger = new Logger(TelegramSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TelegramNotificationsService,
    private readonly ownerAlerts: TelegramOwnerAlertsService,
  ) {}

  // Process pending notification queue every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async processQueue() {
    try {
      await this.notifications.processPendingQueue(30);
    } catch (e) {
      this.logger.warn('Queue processing failed', e);
    }
  }

  // Send daily summaries at 9:00 AM every day
  @Cron('0 9 * * *')
  async sendDailySummaries() {
    try {
      const tenants = await this.prisma.telegramTenantSettings.findMany({
        where: { enabled: true, ownerNotificationsEnabled: true, alertDailySummary: true },
        select: { tenantId: true },
      });

      for (const t of tenants) {
        await this.ownerAlerts.sendDailySummary(t.tenantId);
      }

      this.logger.log(`Daily summaries sent to ${tenants.length} tenants`);
    } catch (e) {
      this.logger.warn('Daily summaries failed', e);
    }
  }

  // Cleanup expired link tokens every hour
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredTokens() {
    try {
      const result = await this.prisma.telegramLinkToken.deleteMany({
        where: { expiresAt: { lt: new Date() }, usedAt: null },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired Telegram link tokens`);
      }
    } catch (e) {
      this.logger.warn('Token cleanup failed', e);
    }
  }

  // Check for low/out-of-stock at 8 AM every day for all tenants
  @Cron('0 8 * * *')
  async checkInventoryAlerts() {
    try {
      const alertRules = await this.prisma.inventoryAlertRule.findMany({
        where: { enabled: true, alertType: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] } },
        include: { tenant: { select: { id: true } } },
      });

      for (const rule of alertRules) {
        if (!rule.productId) continue;

        const stock = await this.prisma.stock.findUnique({
          where: { productId: rule.productId },
          include: { product: { select: { name: true, tenantId: true } } },
        });

        if (!stock) continue;

        const tenantId = stock.product.tenantId;

        const settings = await this.prisma.telegramTenantSettings.findUnique({
          where: { tenantId },
          select: { enabled: true, ownerNotificationsEnabled: true, alertOutOfStock: true, alertLowStock: true },
        });

        if (!settings?.enabled || !settings.ownerNotificationsEnabled) continue;

        const threshold = rule.minQuantity ?? 5;

        if (stock.quantity === 0 && settings.alertOutOfStock) {
          await this.notifications.notifyOwners(
            tenantId,
            'OWNER_OUT_OF_STOCK_ALERT',
            `🚨 <b>Mahsulot tugadi!</b>\n📦 ${stock.product.name}\nOmborda 0 ta qoldi.`,
            `daily_out_of_stock:${rule.productId}:${new Date().toISOString().slice(0, 10)}`,
          );
        } else if (stock.quantity <= threshold && settings.alertLowStock) {
          await this.notifications.notifyOwners(
            tenantId,
            'OWNER_LOW_STOCK_ALERT',
            `⚠️ <b>Kam qolgan mahsulot!</b>\n📦 ${stock.product.name}\n📊 Qoldi: <b>${stock.quantity}</b> ta (chegara: ${threshold})`,
            `daily_low_stock:${rule.productId}:${new Date().toISOString().slice(0, 10)}`,
          );
        }
      }
    } catch (e) {
      this.logger.warn('Inventory alert check failed', e);
    }
  }

  // Check for overdue debts daily at 10 AM
  @Cron('0 10 * * *')
  async checkOverdueDebts() {
    try {
      const overdueReceivables = await this.prisma.receivable.findMany({
        where: {
          status: 'OPEN',
          dueDate: { lt: new Date() },
        },
        include: {
          customer: { select: { name: true, tenantId: true } },
        },
        take: 100,
      });

      // Group by tenant
      const byTenant = new Map<string, typeof overdueReceivables>();
      for (const r of overdueReceivables) {
        const tid = r.customer.tenantId;
        if (!byTenant.has(tid)) byTenant.set(tid, []);
        byTenant.get(tid)!.push(r);
      }

      for (const [tenantId, debts] of byTenant) {
        const settings = await this.prisma.telegramTenantSettings.findUnique({
          where: { tenantId },
          select: { enabled: true, ownerNotificationsEnabled: true, alertDebt: true },
        });
        if (!settings?.enabled || !settings.ownerNotificationsEnabled || !settings.alertDebt) continue;

        const totalOverdue = debts.reduce((s, d) => s + (d.amountDue - d.amountPaid), 0);
        const text =
          `📋 <b>Muddati o'tgan qarzlar</b>\n\n` +
          `🔴 ${debts.length} ta qarz muddati o'tdi\n` +
          `💰 Jami: <b>${totalOverdue.toLocaleString('uz-UZ')}</b> so'm`;

        await this.notifications.notifyOwners(
          tenantId,
          'OWNER_DEBT_OVERDUE_ALERT',
          text,
          `overdue_debts:${tenantId}:${new Date().toISOString().slice(0, 10)}`,
        );
      }
    } catch (e) {
      this.logger.warn('Overdue debt check failed', e);
    }
  }

  // Send weekly summaries every Sunday at 20:00
  @Cron('0 20 * * 0')
  async sendWeeklySummaries() {
    try {
      const tenants = await this.prisma.telegramTenantSettings.findMany({
        where: { enabled: true, ownerNotificationsEnabled: true, alertWeeklySummary: true },
        select: { tenantId: true },
      });
      for (const t of tenants) {
        await this.ownerAlerts.sendWeeklySummary(t.tenantId);
      }
      this.logger.log(`Weekly summaries sent to ${tenants.length} tenants`);
    } catch (e) {
      this.logger.warn('Weekly summaries failed', e);
    }
  }

  // Send monthly summaries on the 28th at 20:00
  @Cron('0 20 28 * *')
  async sendMonthlySummaries() {
    try {
      const tenants = await this.prisma.telegramTenantSettings.findMany({
        where: { enabled: true, ownerNotificationsEnabled: true, alertMonthlySummary: true },
        select: { tenantId: true },
      });
      for (const t of tenants) {
        await this.ownerAlerts.sendMonthlySummary(t.tenantId);
      }
      this.logger.log(`Monthly summaries sent to ${tenants.length} tenants`);
    } catch (e) {
      this.logger.warn('Monthly summaries failed', e);
    }
  }

  // Detect dead stock (stock > 0, no sales in last 30 days) daily at 11:00 AM
  @Cron('0 11 * * *')
  async checkDeadStock() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find products that have stock but no recent sales
      const allStocks = await this.prisma.stock.findMany({
        where: { quantity: { gt: 0 } },
        include: { product: { select: { id: true, name: true, tenantId: true } } },
      });

      // Group by tenant to batch alerts
      const deadByTenant = new Map<string, Array<{ name: string; quantity: number }>>();

      for (const stock of allStocks) {
        const recentSale = await this.prisma.saleItem.findFirst({
          where: {
            productId: stock.productId,
            sale: { createdAt: { gte: thirtyDaysAgo } },
          },
        });
        if (recentSale) continue; // has recent sales

        const tid = stock.product.tenantId;
        if (!deadByTenant.has(tid)) deadByTenant.set(tid, []);
        deadByTenant.get(tid)!.push({ name: stock.product.name, quantity: stock.quantity });
      }

      for (const [tenantId, items] of deadByTenant) {
        const settings = await this.prisma.telegramTenantSettings.findUnique({
          where: { tenantId },
          select: { enabled: true, ownerNotificationsEnabled: true, alertLowStock: true },
        });
        if (!settings?.enabled || !settings.ownerNotificationsEnabled || !settings.alertLowStock) continue;

        const lines = items.slice(0, 10).map((p) => `• ${p.name} — ${p.quantity} ta`).join('\n');
        const text =
          `📦 <b>Harakatsiz mahsulotlar (30+ kun)</b>\n\n` +
          lines +
          (items.length > 10 ? `\n... va yana ${items.length - 10} ta` : '');

        await this.notifications.notifyOwners(
          tenantId,
          'OWNER_DEAD_STOCK_ALERT',
          text,
          `dead_stock:${tenantId}:${new Date().toISOString().slice(0, 10)}`,
        );
      }

      this.logger.log(`Dead stock check complete: ${deadByTenant.size} tenants alerted`);
    } catch (e) {
      this.logger.warn('Dead stock check failed', e);
    }
  }

  // Notify customers with inactive cashback cards (balance > 0, no transaction in 60 days) — bonus expiry reminder
  @Cron('0 9 * * 1') // Every Monday at 9:00 AM
  async checkBonusExpiry() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);

      const inactiveCards = await this.prisma.cashbackCard.findMany({
        where: {
          isActive: true,
          balance: { gt: 0 },
          transactions: { none: { createdAt: { gte: cutoff } } },
        },
        include: {
          customer: { select: { name: true, tenantId: true } },
          tenant: { select: { name: true } },
        },
        take: 200,
      });

      for (const card of inactiveCards) {
        const settings = await this.prisma.telegramTenantSettings.findUnique({
          where: { tenantId: card.customer.tenantId },
          select: { enabled: true, customerBotEnabled: true, customerBonusExpiry: true },
        });
        if (!settings?.enabled || !settings.customerBotEnabled || !settings.customerBonusExpiry) continue;

        // Find linked telegram identity for the customer
        const link = await this.prisma.telegramLink.findFirst({
          where: {
            tenantId: card.customer.tenantId,
            entityType: 'CUSTOMER',
            entityId: card.customerId,
          },
        });
        if (!link?.telegramIdentityId) continue;

        const text =
          `⏰ <b>Bonuslar eslatmasi</b>\n\n` +
          `Salom, <b>${card.customer.name}</b>!\n\n` +
          `Sizning <b>${card.balance.toLocaleString('uz-UZ')}</b> so'mlik bonusingiz 60 kundan beri faolsiz.\n` +
          `Do'konga tashrif buyuring va bonuslaringizdan foydalaning! 🛍️`;

        await this.notifications.enqueue({
          tenantId: card.customer.tenantId,
          telegramIdentityId: link.telegramIdentityId,
          notificationType: 'CUSTOMER_BONUS_EXPIRY',
          audience: TgAudience.CUSTOMER,
          payloadJson: { text, parseMode: 'HTML' },
          dedupeKey: `bonus_expiry:${card.id}:${new Date().toISOString().slice(0, 7)}`,
        });
      }

      this.logger.log(`Bonus expiry reminders queued for ${inactiveCards.length} cards`);
    } catch (e) {
      this.logger.warn('Bonus expiry check failed', e);
    }
  }
}
