import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../db/prisma.service';
import { TelegramApiService } from '../core/telegram-api.service';
import { TgAudience, TgNotifStatus, TgQueueStatus, TgQueuePriority } from '@prisma/client';

export interface EnqueueOptions {
  tenantId?: string;
  notificationType: string;
  audience: TgAudience;
  telegramIdentityId?: string;
  payloadJson: Record<string, unknown>;
  dedupeKey?: string;
  priority?: TgQueuePriority;
  scheduledFor?: Date;
}

@Injectable()
export class TelegramNotificationsService {
  private readonly logger = new Logger(TelegramNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: TelegramApiService,
    private readonly config: ConfigService,
  ) {}

  // Enqueue a notification (non-blocking, used by business services)
  async enqueue(opts: EnqueueOptions): Promise<void> {
    // Global kill-switch: TELEGRAM_NOTIFICATIONS_ENABLED=false disables all sends
    if (this.config.get<boolean>('telegram.notificationsEnabled') === false) return;
    try {
      // Deduplication: skip if same dedupeKey already PENDING/SENT
      if (opts.dedupeKey) {
        const existing = await this.prisma.telegramNotificationQueue.findFirst({
          where: {
            dedupeKey: opts.dedupeKey,
            status: { in: [TgQueueStatus.PENDING, TgQueueStatus.SENT] },
          },
        });
        if (existing) return;
      }

      await this.prisma.telegramNotificationQueue.create({
        data: {
          tenantId: opts.tenantId,
          notificationType: opts.notificationType,
          audience: opts.audience,
          telegramIdentityId: opts.telegramIdentityId,
          payloadJson: opts.payloadJson as any,
          dedupeKey: opts.dedupeKey,
          priority: opts.priority ?? TgQueuePriority.NORMAL,
          scheduledFor: opts.scheduledFor ?? new Date(),
        },
      });
    } catch (e) {
      // never block caller
      this.logger.warn('Failed to enqueue notification', e);
    }
  }

  // Process pending queue items — called by a scheduled job
  async processPendingQueue(batchSize = 20): Promise<void> {
    const items = await this.prisma.telegramNotificationQueue.findMany({
      where: {
        status: TgQueueStatus.PENDING,
        scheduledFor: { lte: new Date() },
      },
      orderBy: [{ priority: 'desc' }, { scheduledFor: 'asc' }],
      take: batchSize,
      include: { telegramIdentity: true },
    });

    for (const item of items) {
      if (!item.telegramIdentity) {
        await this.prisma.telegramNotificationQueue.update({
          where: { id: item.id },
          data: { status: TgQueueStatus.FAILED, lastError: 'No identity found' },
        });
        continue;
      }

      if (item.telegramIdentity.isBlocked || !item.telegramIdentity.isActive) {
        await this.prisma.telegramNotificationQueue.update({
          where: { id: item.id },
          data: { status: TgQueueStatus.CANCELLED },
        });
        continue;
      }

      await this.prisma.telegramNotificationQueue.update({
        where: { id: item.id },
        data: { status: TgQueueStatus.PROCESSING },
      });

      const payload = item.payloadJson as Record<string, unknown>;
      const text = (payload.text as string) ?? JSON.stringify(payload);

      const result = await this.api.sendMessage({
        chatId: item.telegramIdentity.telegramChatId,
        text,
        parseMode: 'HTML',
      });

      if (result.ok) {
        await this.prisma.telegramNotificationQueue.update({
          where: { id: item.id },
          data: { status: TgQueueStatus.SENT },
        });
        await this.prisma.telegramNotificationLog.create({
          data: {
            tenantId: item.tenantId,
            telegramIdentityId: item.telegramIdentityId,
            notificationType: item.notificationType,
            audience: item.audience,
            payloadJson: item.payloadJson,
            messageTextSnapshot: text,
            telegramMessageId: String(result.result?.message_id ?? ''),
            status: TgNotifStatus.SENT,
            sentAt: new Date(),
          },
        });
      } else {
        const isFatal = result.error_code === 403; // bot blocked
        await this.prisma.telegramNotificationQueue.update({
          where: { id: item.id },
          data: {
            status: isFatal ? TgQueueStatus.FAILED : TgQueueStatus.PENDING,
            retryCount: { increment: 1 },
            lastError: result.description,
            scheduledFor: isFatal ? undefined : new Date(Date.now() + 5 * 60 * 1000),
          },
        });

        if (isFatal) {
          await this.prisma.telegramIdentity.update({
            where: { id: item.telegramIdentityId! },
            data: { isBlocked: true, blockedAt: new Date() },
          });
        }

        await this.prisma.telegramNotificationLog.create({
          data: {
            tenantId: item.tenantId,
            telegramIdentityId: item.telegramIdentityId,
            notificationType: item.notificationType,
            audience: item.audience,
            payloadJson: item.payloadJson,
            messageTextSnapshot: text,
            status: isFatal ? TgNotifStatus.BLOCKED : TgNotifStatus.FAILED,
            errorCode: String(result.error_code ?? ''),
            errorMessage: result.description,
            retryCount: item.retryCount + 1,
          },
        });
      }
    }
  }

  // Notify all owner-linked accounts for a tenant
  async notifyOwners(
    tenantId: string,
    notificationType: string,
    text: string,
    dedupeKey?: string,
  ): Promise<void> {
    const links = await this.prisma.telegramLink.findMany({
      where: {
        tenantId,
        entityType: { in: ['OWNER', 'USER'] },
        verified: true,
        telegramIdentity: { isBlocked: false, isActive: true },
      },
      include: { telegramIdentity: true },
    });

    for (const link of links) {
      await this.enqueue({
        tenantId,
        notificationType,
        audience: TgAudience.OWNER,
        telegramIdentityId: link.telegramIdentityId,
        payloadJson: { text },
        dedupeKey: dedupeKey ? `${dedupeKey}:${link.telegramIdentityId}` : undefined,
      });
    }
  }

  async getLogs(tenantId: string, limit = 50) {
    return this.prisma.telegramNotificationLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        telegramIdentity: { select: { telegramUsername: true, firstName: true } },
      },
    });
  }

  async getQueue(tenantId?: string) {
    return this.prisma.telegramNotificationQueue.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── Notification Preferences ───────────────────────────────────────────────

  async getPreferences(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.telegramNotificationPreference.findMany({
      where: { tenantId, entityType: entityType as any, entityId },
      orderBy: { notificationType: 'asc' },
    });
  }

  async upsertPreference(dto: {
    tenantId: string;
    entityType: string;
    entityId: string;
    telegramIdentityId?: string;
    notificationType: string;
    enabled: boolean;
    deliveryMode?: string;
  }) {
    return this.prisma.telegramNotificationPreference.upsert({
      where: {
        tenantId_entityType_entityId_notificationType: {
          tenantId: dto.tenantId,
          entityType: dto.entityType as any,
          entityId: dto.entityId,
          notificationType: dto.notificationType,
        },
      },
      create: {
        tenantId: dto.tenantId,
        entityType: dto.entityType as any,
        entityId: dto.entityId,
        telegramIdentityId: dto.telegramIdentityId,
        notificationType: dto.notificationType,
        enabled: dto.enabled,
        deliveryMode: (dto.deliveryMode as any) ?? 'INSTANT',
      },
      update: {
        enabled: dto.enabled,
        deliveryMode: (dto.deliveryMode as any) ?? undefined,
        telegramIdentityId: dto.telegramIdentityId ?? undefined,
      },
    });
  }

  async getDeliveryStats(tenantId?: string) {
    const where = tenantId ? { tenantId } : {};
    const [sent, failed, pending, blocked] = await Promise.all([
      this.prisma.telegramNotificationLog.count({ where: { ...where, status: 'SENT' as any } }),
      this.prisma.telegramNotificationLog.count({ where: { ...where, status: 'FAILED' as any } }),
      this.prisma.telegramNotificationQueue.count({ where: { ...where, status: 'PENDING' as any } }),
      this.prisma.telegramNotificationLog.count({ where: { ...where, status: 'BLOCKED' as any } }),
    ]);
    return { sent, failed, pending, blocked, total: sent + failed + blocked };
  }
}
