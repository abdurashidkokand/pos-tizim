import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../db/prisma.service';
import { TelegramNotificationsService } from '../notifications/telegram-notifications.service';
import { EVENTS } from '../events/domain-events';
import type {
  SaleCreatedEvent,
  StockLowEvent,
  StockOutEvent,
  CashSessionOpenedEvent,
  CashSessionClosedEvent,
  DebtCreatedEvent,
  DebtPaidEvent,
} from '../events/domain-events';

@Injectable()
export class TelegramOwnerAlertsService {
  private readonly logger = new Logger(TelegramOwnerAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TelegramNotificationsService,
  ) {}

  private async isEnabled(tenantId: string): Promise<boolean> {
    const settings = await this.prisma.telegramTenantSettings.findUnique({
      where: { tenantId },
      select: { enabled: true, ownerNotificationsEnabled: true },
    });
    return !!(settings?.enabled && settings.ownerNotificationsEnabled);
  }

  private fmt(n: number): string {
    return n.toLocaleString('uz-UZ');
  }

  @OnEvent(EVENTS.SALE_CREATED)
  async onSaleCreated(evt: SaleCreatedEvent) {
    try {
      if (!evt.tenantId || !(await this.isEnabled(evt.tenantId))) return;

      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId: evt.tenantId },
        select: { alertLargeDiscount: true, alertDebt: true },
      });

      if (evt.discount > 0 && settings?.alertLargeDiscount) {
        const text =
          `💸 <b>Katta chegirma!</b>\n` +
          `📄 Chek: #${evt.receiptNo}\n` +
          `💰 Jami: ${this.fmt(evt.total)} so'm\n` +
          `🏷 Chegirma: ${this.fmt(evt.discount)} so'm`;
        await this.notifications.notifyOwners(
          evt.tenantId,
          'OWNER_LARGE_DISCOUNT_ALERT',
          text,
          `large_discount:${evt.saleId}`,
        );
      }

      if (evt.status === 'PARTIAL' && evt.debtAmount && settings?.alertDebt) {
        const text =
          `🧾 <b>Qarzga sotuv!</b>\n` +
          `📄 Chek: #${evt.receiptNo}\n` +
          `💰 Jami: ${this.fmt(evt.total)} so'm\n` +
          `🔴 Qarz: ${this.fmt(evt.debtAmount)} so'm`;
        await this.notifications.notifyOwners(
          evt.tenantId,
          'OWNER_DEBT_CREATED_ALERT',
          text,
          `debt_created:${evt.saleId}`,
        );
      }
    } catch (e) {
      this.logger.warn('onSaleCreated alert failed', e);
    }
  }

  @OnEvent(EVENTS.STOCK_LOW)
  async onStockLow(evt: StockLowEvent) {
    try {
      if (!evt.tenantId || !(await this.isEnabled(evt.tenantId))) return;

      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId: evt.tenantId },
        select: { alertLowStock: true },
      });
      if (!settings?.alertLowStock) return;

      const text =
        `⚠️ <b>Kam qolgan mahsulot!</b>\n` +
        `📦 ${evt.productName}\n` +
        `📊 Qoldi: <b>${evt.currentQty}</b> ta (chegara: ${evt.threshold})`;
      await this.notifications.notifyOwners(
        evt.tenantId,
        'OWNER_LOW_STOCK_ALERT',
        text,
        `low_stock:${evt.productId}:${Math.floor(Date.now() / 3600000)}`,
      );
    } catch (e) {
      this.logger.warn('onStockLow alert failed', e);
    }
  }

  @OnEvent(EVENTS.STOCK_OUT)
  async onStockOut(evt: StockOutEvent) {
    try {
      if (!evt.tenantId || !(await this.isEnabled(evt.tenantId))) return;

      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId: evt.tenantId },
        select: { alertOutOfStock: true },
      });
      if (!settings?.alertOutOfStock) return;

      const text =
        `🚨 <b>Mahsulot tugadi!</b>\n` +
        `📦 ${evt.productName}\n` +
        `Omborda 0 ta qoldi.`;
      await this.notifications.notifyOwners(
        evt.tenantId,
        'OWNER_OUT_OF_STOCK_ALERT',
        text,
        `out_of_stock:${evt.productId}:${Math.floor(Date.now() / 3600000)}`,
      );
    } catch (e) {
      this.logger.warn('onStockOut alert failed', e);
    }
  }

  @OnEvent(EVENTS.CASH_SESSION_OPENED)
  async onCashSessionOpened(evt: CashSessionOpenedEvent) {
    try {
      if (!evt.tenantId || !(await this.isEnabled(evt.tenantId))) return;

      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId: evt.tenantId },
        select: { alertCashSession: true },
      });
      if (!settings?.alertCashSession) return;

      const user = await this.prisma.user.findUnique({
        where: { id: evt.userId },
        select: { username: true },
      });

      const text =
        `🟢 <b>Kassa sessiya ochildi</b>\n` +
        `👤 Kassir: ${user?.username ?? evt.userId}\n` +
        `💵 Boshlang'ich: ${this.fmt(evt.openingCash)} so'm`;
      await this.notifications.notifyOwners(
        evt.tenantId,
        'OWNER_CASH_SESSION_OPENED',
        text,
        `session_opened:${evt.sessionId}`,
      );
    } catch (e) {
      this.logger.warn('onCashSessionOpened alert failed', e);
    }
  }

  @OnEvent(EVENTS.CASH_SESSION_CLOSED)
  async onCashSessionClosed(evt: CashSessionClosedEvent) {
    try {
      if (!evt.tenantId || !(await this.isEnabled(evt.tenantId))) return;

      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId: evt.tenantId },
        select: { alertCashSession: true },
      });
      if (!settings?.alertCashSession) return;

      const user = await this.prisma.user.findUnique({
        where: { id: evt.userId },
        select: { username: true },
      });

      const variance = evt.closingCash - evt.openingCash;
      const text =
        `🔴 <b>Kassa sessiya yopildi</b>\n` +
        `👤 Kassir: ${user?.username ?? evt.userId}\n` +
        `💵 Yopilish: ${this.fmt(evt.closingCash)} so'm\n` +
        `${variance !== 0 ? `⚡ Farq: ${variance > 0 ? '+' : ''}${this.fmt(variance)} so'm\n` : ''}`;
      await this.notifications.notifyOwners(
        evt.tenantId,
        'OWNER_CASH_SESSION_CLOSED',
        text,
        `session_closed:${evt.sessionId}`,
      );
    } catch (e) {
      this.logger.warn('onCashSessionClosed alert failed', e);
    }
  }

  @OnEvent(EVENTS.DEBT_CREATED)
  async onDebtCreated(evt: DebtCreatedEvent) {
    try {
      if (!evt.tenantId || !(await this.isEnabled(evt.tenantId))) return;

      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId: evt.tenantId },
        select: { alertDebt: true },
      });
      if (!settings?.alertDebt) return;

      const text =
        `🧾 <b>Yangi qarz!</b>\n` +
        `👤 Mijoz: ${evt.customerName}\n` +
        `📄 Chek: #${evt.receiptNo}\n` +
        `💰 Qarz: ${this.fmt(evt.amountDue)} so'm`;
      await this.notifications.notifyOwners(
        evt.tenantId,
        'OWNER_DEBT_CREATED_ALERT',
        text,
        `debt:${evt.saleId}`,
      );
    } catch (e) {
      this.logger.warn('onDebtCreated alert failed', e);
    }
  }

  @OnEvent(EVENTS.DEBT_PAID)
  async onDebtPaid(evt: DebtPaidEvent) {
    try {
      if (!evt.tenantId || !(await this.isEnabled(evt.tenantId))) return;

      const text =
        `✅ <b>Qarz to'landi!</b>\n` +
        `👤 Mijoz: ${evt.customerName}\n` +
        `💵 To'landi: ${this.fmt(evt.amountPaid)} so'm` +
        (evt.remaining > 0 ? `\n🔴 Qoldi: ${this.fmt(evt.remaining)} so'm` : `\n🎉 To'liq uzildi!`);
      await this.notifications.notifyOwners(
        evt.tenantId,
        'OWNER_DEBT_PAID_ALERT',
        text,
        `debt_paid:${evt.receivableId}`,
      );
    } catch (e) {
      this.logger.warn('onDebtPaid alert failed', e);
    }
  }

  // Called by scheduler cron for daily summary
  async sendDailySummary(tenantId: string): Promise<void> {
    try {
      if (!(await this.isEnabled(tenantId))) return;

      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId },
        select: { alertDailySummary: true },
      });
      if (!settings?.alertDailySummary) return;

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();

      const [sales, topProducts] = await Promise.all([
        this.prisma.sale.aggregate({
          where: { tenantId, createdAt: { gte: start, lte: end } },
          _sum: { total: true, grossProfit: true, discount: true },
          _count: { id: true },
        }),
        this.prisma.saleItem.groupBy({
          by: ['productId'],
          where: { sale: { tenantId, createdAt: { gte: start, lte: end } } },
          _sum: { qty: true },
          orderBy: { _sum: { qty: 'desc' } },
          take: 3,
        }),
      ]);

      const productIds = topProducts.map((p) => p.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      const prodMap = new Map(products.map((p) => [p.id, p.name]));

      const today = new Date().toLocaleDateString('uz-UZ');
      let text =
        `📊 <b>Kunlik hisobot — ${today}</b>\n\n` +
        `🛒 Sotuvlar: <b>${sales._count.id}</b> ta\n` +
        `💰 Tushum: <b>${this.fmt(sales._sum.total ?? 0)}</b> so'm\n` +
        `📈 Foyda: <b>${this.fmt(sales._sum.grossProfit ?? 0)}</b> so'm\n` +
        `🏷 Chegirma: ${this.fmt(sales._sum.discount ?? 0)} so'm`;

      if (topProducts.length > 0) {
        text += `\n\n🔝 <b>Top mahsulotlar:</b>\n`;
        topProducts.forEach((tp, i) => {
          text += `${i + 1}. ${prodMap.get(tp.productId) ?? tp.productId} — ${tp._sum.qty ?? 0} ta\n`;
        });
      }

      await this.notifications.notifyOwners(
        tenantId,
        'OWNER_DAILY_SUMMARY',
        text,
        `daily_summary:${tenantId}:${today}`,
      );
    } catch (e) {
      this.logger.warn(`Daily summary failed for ${tenantId}`, e);
    }
  }

  async sendWeeklySummary(tenantId: string): Promise<void> {
    try {
      if (!(await this.isEnabled(tenantId))) return;
      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId },
        select: { alertWeeklySummary: true },
      });
      if (!settings?.alertWeeklySummary) return;

      await this.sendPeriodSummary(tenantId, 7, 'Haftalik');
    } catch (e) {
      this.logger.warn(`Weekly summary failed for ${tenantId}`, e);
    }
  }

  async sendMonthlySummary(tenantId: string): Promise<void> {
    try {
      if (!(await this.isEnabled(tenantId))) return;
      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId },
        select: { alertMonthlySummary: true },
      });
      if (!settings?.alertMonthlySummary) return;

      await this.sendPeriodSummary(tenantId, 30, 'Oylik');
    } catch (e) {
      this.logger.warn(`Monthly summary failed for ${tenantId}`, e);
    }
  }

  private async sendPeriodSummary(tenantId: string, days: number, label: string): Promise<void> {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const end = new Date();

    const [sales, topProducts] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        _sum: { total: true, grossProfit: true, discount: true },
        _count: { id: true },
      }),
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { tenantId, createdAt: { gte: start, lte: end } } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 5,
      }),
    ]);

    const productIds = topProducts.map((p) => p.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const prodMap = new Map(products.map((p) => [p.id, p.name]));

    const rangeStr = `${start.toLocaleDateString('uz-UZ')} – ${end.toLocaleDateString('uz-UZ')}`;
    let text =
      `📊 <b>${label} hisobot</b>\n${rangeStr}\n\n` +
      `🛒 Sotuvlar: <b>${sales._count.id}</b> ta\n` +
      `💰 Tushum: <b>${this.fmt(sales._sum.total ?? 0)}</b> so'm\n` +
      `📈 Foyda: <b>${this.fmt(sales._sum.grossProfit ?? 0)}</b> so'm\n` +
      `🏷 Chegirma: ${this.fmt(sales._sum.discount ?? 0)} so'm`;

    if (topProducts.length > 0) {
      text += `\n\n🔝 <b>Top ${topProducts.length} mahsulot:</b>\n`;
      topProducts.forEach((tp, i) => {
        text += `${i + 1}. ${prodMap.get(tp.productId) ?? tp.productId} — ${tp._sum.qty ?? 0} ta\n`;
      });
    }

    const periodKey = `${label.toLowerCase()}_summary:${tenantId}:${start.toISOString().slice(0, 10)}`;
    await this.notifications.notifyOwners(tenantId, 'OWNER_WEEKLY_SUMMARY', text, periodKey);
  }
}
