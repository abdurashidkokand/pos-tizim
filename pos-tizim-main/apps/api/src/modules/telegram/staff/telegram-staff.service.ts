import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';
import { TelegramNotificationsService } from '../notifications/telegram-notifications.service';
import { TelegramApiService } from '../core/telegram-api.service';
import { TgAudience, TgLinkEntityType } from '@prisma/client';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../events/domain-events';
import type { StockLowEvent, StockOutEvent } from '../events/domain-events';

@Injectable()
export class TelegramStaffService {
  private readonly logger = new Logger(TelegramStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TelegramNotificationsService,
    private readonly api: TelegramApiService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  //  Query helpers
  // ──────────────────────────────────────────────────────────────────────────

  async getLinkedStaff(tenantId: string) {
    return this.prisma.telegramLink.findMany({
      where: {
        tenantId,
        entityType: { in: [TgLinkEntityType.STAFF, TgLinkEntityType.USER] },
      },
      include: {
        telegramIdentity: {
          select: {
            telegramUsername: true,
            firstName: true,
            lastName: true,
            telegramChatId: true,
            isBlocked: true,
            lastSeenAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isStaffBotEnabled(tenantId: string): Promise<boolean> {
    const s = await this.prisma.telegramTenantSettings.findUnique({
      where: { tenantId },
      select: { enabled: true, staffBotEnabled: true },
    });
    return !!(s?.enabled && s.staffBotEnabled);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Notify all linked staff for a tenant
  // ──────────────────────────────────────────────────────────────────────────

  async notifyAllStaff(
    tenantId: string,
    notificationType: string,
    text: string,
    dedupeKey?: string,
  ): Promise<void> {
    if (!(await this.isStaffBotEnabled(tenantId))) return;

    const links = await this.prisma.telegramLink.findMany({
      where: {
        tenantId,
        entityType: { in: [TgLinkEntityType.STAFF, TgLinkEntityType.USER] },
      },
      select: { telegramIdentityId: true },
    });

    for (const link of links) {
      await this.notifications.enqueue({
        tenantId,
        telegramIdentityId: link.telegramIdentityId,
        notificationType,
        audience: TgAudience.STAFF,
        payloadJson: { text, parseMode: 'HTML' },
        dedupeKey: dedupeKey ? `${dedupeKey}:${link.telegramIdentityId}` : undefined,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Shift reminder
  // ──────────────────────────────────────────────────────────────────────────

  async sendShiftReminder(tenantId: string, shiftTime: string, branchName?: string): Promise<void> {
    const text =
      `⏰ <b>Smena eslatmasi</b>\n\n` +
      `Bugungi smena: <b>${shiftTime}</b>\n` +
      (branchName ? `📍 Filial: ${branchName}\n` : '') +
      `Ish vaqtida bo'ling!`;

    await this.notifyAllStaff(
      tenantId,
      'STAFF_SHIFT_REMINDER',
      text,
      `shift_reminder:${tenantId}:${new Date().toISOString().slice(0, 10)}`,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Stock task alert
  // ──────────────────────────────────────────────────────────────────────────

  async sendStockTaskAlert(tenantId: string, productName: string, qty: number, message?: string): Promise<void> {
    const text =
      `📦 <b>Ombor vazifasi</b>\n\n` +
      `Mahsulot: <b>${productName}</b>\n` +
      `Miqdor: <b>${qty}</b> ta\n` +
      (message ? `📝 ${message}` : '');

    await this.notifyAllStaff(tenantId, 'STAFF_STOCK_TASK', text);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Manual broadcast to specific staff link
  // ──────────────────────────────────────────────────────────────────────────

  async sendDirectToStaff(linkId: string, text: string, tenantId: string): Promise<{ ok: boolean; description?: string }> {
    const link = await this.prisma.telegramLink.findFirst({
      where: { id: linkId, tenantId },
      include: { telegramIdentity: { select: { telegramChatId: true, isBlocked: true } } },
    });

    if (!link?.telegramIdentity?.telegramChatId) return { ok: false, description: 'Ulangan akkaunt topilmadi' };
    if (link.telegramIdentity.isBlocked) return { ok: false, description: 'Bot bloklangan' };

    return this.api.sendMessage({
      chatId: link.telegramIdentity.telegramChatId,
      text,
      parseMode: 'HTML',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Event handlers: forward relevant inventory events to staff
  // ──────────────────────────────────────────────────────────────────────────

  @OnEvent(EVENTS.STOCK_LOW)
  async onStockLow(payload: StockLowEvent): Promise<void> {
    try {
      if (!(await this.isStaffBotEnabled(payload.tenantId))) return;

      const text =
        `⚠️ <b>Kam qolgan mahsulot</b>\n\n` +
        `📦 ${payload.productName}\n` +
        `📊 Qoldi: <b>${payload.currentQty}</b> ta\n` +
        `🔔 Zudlik bilan to'ldiring`;

      await this.notifyAllStaff(
        payload.tenantId,
        'STAFF_LOW_STOCK_ASSIGNMENT',
        text,
        `staff_low_stock:${payload.productId}:${new Date().toISOString().slice(0, 10)}`,
      );
    } catch (e) {
      this.logger.warn('Staff low stock event failed', e);
    }
  }

  @OnEvent(EVENTS.STOCK_OUT)
  async onStockOut(payload: StockOutEvent): Promise<void> {
    try {
      if (!(await this.isStaffBotEnabled(payload.tenantId))) return;

      const text =
        `🚨 <b>Mahsulot TUGADI!</b>\n\n` +
        `📦 ${payload.productName}\n` +
        `Zudlik bilan kirim qiling!`;

      await this.notifyAllStaff(
        payload.tenantId,
        'STAFF_STOCK_TASK',
        text,
        `staff_out_of_stock:${payload.productId}:${new Date().toISOString().slice(0, 10)}`,
      );
    } catch (e) {
      this.logger.warn('Staff out-of-stock event failed', e);
    }
  }
}
