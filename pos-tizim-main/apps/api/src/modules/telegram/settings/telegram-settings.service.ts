import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { TelegramApiService } from '../core/telegram-api.service';
import type { AuthUser } from '@pos/shared';

export interface SaveBotConfigDto {
  name?: string;
  botToken: string;
  botUsername: string;
  webhookUrl?: string;
  webhookSecret?: string;
  miniAppUrl?: string;
  isActive?: boolean;
}

export interface UpdateTenantSettingsDto {
  enabled?: boolean;
  ownerNotificationsEnabled?: boolean;
  customerBotEnabled?: boolean;
  staffBotEnabled?: boolean;
  miniAppEnabled?: boolean;
  deepLinkBaseUrl?: string;
  defaultLanguage?: string;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  alertDailySummary?: boolean;
  alertWeeklySummary?: boolean;
  alertMonthlySummary?: boolean;
  alertLowStock?: boolean;
  alertOutOfStock?: boolean;
  alertRefund?: boolean;
  alertDebt?: boolean;
  alertCashSession?: boolean;
  alertLargeDiscount?: boolean;
  alertInventoryMismatch?: boolean;
  customerReceiptMessage?: boolean;
  customerCashbackNotif?: boolean;
  customerBonusExpiry?: boolean;
  customerStampProgress?: boolean;
  customerPromoEnabled?: boolean;
}

const MASKED = '••••••••••••••••';

@Injectable()
export class TelegramSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly api: TelegramApiService,
  ) {}

  // ── SUPERADMIN: Global config ────────────────────────────────

  async getGlobalConfig(user: AuthUser) {
    if (user.role !== 'SUPERADMIN') throw new ForbiddenException();
    const cfg = await this.prisma.telegramBotConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!cfg) return null;
    return { ...cfg, botTokenEncrypted: MASKED };
  }

  async saveGlobalConfig(dto: SaveBotConfigDto, user: AuthUser) {
    if (user.role !== 'SUPERADMIN') throw new ForbiddenException();

    const existing = await this.prisma.telegramBotConfig.findFirst({ where: { isActive: true } });
    // '__KEEP__' sentinel means "don't change the stored token"
    const encrypted =
      dto.botToken === '__KEEP__' && existing
        ? existing.botTokenEncrypted
        : this.api.encryptToken(dto.botToken);

    let cfg;
    if (existing) {
      cfg = await this.prisma.telegramBotConfig.update({
        where: { id: existing.id },
        data: {
          name: dto.name ?? existing.name,
          botTokenEncrypted: encrypted,
          botUsername: dto.botUsername,
          webhookUrl: dto.webhookUrl,
          webhookSecret: dto.webhookSecret,
          miniAppUrl: dto.miniAppUrl,
          isActive: dto.isActive ?? true,
          updatedByUserId: user.id,
        },
      });
    } else {
      cfg = await this.prisma.telegramBotConfig.create({
        data: {
          name: dto.name ?? 'default',
          botTokenEncrypted: encrypted,
          botUsername: dto.botUsername,
          webhookUrl: dto.webhookUrl,
          webhookSecret: dto.webhookSecret,
          miniAppUrl: dto.miniAppUrl,
          isActive: dto.isActive ?? true,
          status: 'CONFIGURED',
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    }

    await this.api.refreshToken();

    await this.audit.log(
      user.id,
      'TELEGRAM_BOT_CONFIG_SAVED',
      'TelegramBotConfig',
      cfg.id,
      { botUsername: dto.botUsername },
      null,
    );

    return { ...cfg, botTokenEncrypted: MASKED };
  }

  async rotateToken(newToken: string, user: AuthUser) {
    if (user.role !== 'SUPERADMIN') throw new ForbiddenException();
    const cfg = await this.prisma.telegramBotConfig.findFirst({ where: { isActive: true } });
    if (!cfg) throw new NotFoundException('No active bot config');

    const encrypted = this.api.encryptToken(newToken);
    const updated = await this.prisma.telegramBotConfig.update({
      where: { id: cfg.id },
      data: { botTokenEncrypted: encrypted, updatedByUserId: user.id, status: 'CONFIGURED' },
    });
    await this.api.refreshToken();

    await this.audit.log(
      user.id,
      'TELEGRAM_TOKEN_ROTATED',
      'TelegramBotConfig',
      cfg.id,
      {},
      null,
    );

    return { ...updated, botTokenEncrypted: MASKED };
  }

  async setWebhook(user: AuthUser) {
    if (user.role !== 'SUPERADMIN') throw new ForbiddenException();
    const cfg = await this.prisma.telegramBotConfig.findFirst({ where: { isActive: true } });
    if (!cfg?.webhookUrl) throw new NotFoundException('Webhook URL not configured');

    const result = await this.api.setWebhook(cfg.webhookUrl, cfg.webhookSecret ?? undefined);

    await this.prisma.telegramBotConfig.update({
      where: { id: cfg.id },
      data: {
        lastWebhookSetAt: new Date(),
        status: result.ok ? 'WEBHOOK_SET' : 'WEBHOOK_FAILED',
      },
    });
    return result;
  }

  async deleteWebhook(user: AuthUser) {
    if (user.role !== 'SUPERADMIN') throw new ForbiddenException();
    return this.api.deleteWebhook();
  }

  async healthCheck(user: AuthUser) {
    if (user.role !== 'SUPERADMIN') throw new ForbiddenException();
    const result = await this.api.getMe();

    const cfg = await this.prisma.telegramBotConfig.findFirst({ where: { isActive: true } });
    if (cfg) {
      await this.prisma.telegramBotConfig.update({
        where: { id: cfg.id },
        data: {
          lastHealthCheckAt: new Date(),
          status: result.ok ? 'HEALTHY' : 'UNHEALTHY',
        },
      });
    }
    return result;
  }

  async sendTestMessage(chatId: string, user: AuthUser) {
    if (user.role !== 'SUPERADMIN') throw new ForbiddenException();
    return this.api.sendMessage({
      chatId,
      text: `<b>Test xabar</b>\n\nBot to'g'ri ishlayapti. Foydalanuvchi: <code>${user.username}</code>`,
      parseMode: 'HTML',
    });
  }

  // ── TENANT: Per-tenant settings ──────────────────────────────

  async getTenantSettings(tenantId: string) {
    return this.prisma.telegramTenantSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async updateTenantSettings(tenantId: string, dto: UpdateTenantSettingsDto, user: AuthUser) {
    const updated = await this.prisma.telegramTenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });

    await this.audit.log(
      user.id,
      'TELEGRAM_TENANT_SETTINGS_UPDATED',
      'TelegramTenantSettings',
      updated.id,
      dto as Record<string, unknown>,
      tenantId,
    );

    return updated;
  }

  // ── SUPERADMIN: Tenant overview ──────────────────────────────

  async getTenantsOverview(user: AuthUser) {
    if (user.role !== 'SUPERADMIN') throw new ForbiddenException();

    const settings = await this.prisma.telegramTenantSettings.findMany({
      include: { tenant: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const tenantIds = settings.map((s) => s.tenantId);

    const [linkCounts, queueStats] = await Promise.all([
      this.prisma.telegramLink.groupBy({
        by: ['tenantId'],
        _count: { id: true },
        where: { tenantId: { in: tenantIds } },
      }),
      this.prisma.telegramNotificationQueue.groupBy({
        by: ['tenantId', 'status'],
        _count: { id: true },
        where: { tenantId: { in: tenantIds } },
      }),
    ]);

    const linkMap = new Map(linkCounts.map((l) => [l.tenantId, l._count.id]));

    return settings.map((s) => ({
      ...s,
      linkedAccountsCount: linkMap.get(s.tenantId) ?? 0,
      queueStats: queueStats
        .filter((q) => q.tenantId === s.tenantId)
        .map((q) => ({ status: q.status, count: q._count.id })),
    }));
  }
}
