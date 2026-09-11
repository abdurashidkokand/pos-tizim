import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../db/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { TelegramApiService } from '../core/telegram-api.service';
import { TgLinkSource, TgLinkEntityType, Role } from '@prisma/client';
import type { AuthUser } from '@pos/shared';

export interface GenerateLinkTokenDto {
  entityType: TgLinkEntityType;
  entityId: string;
  intendedRole?: Role;
}

export interface ConsumeLinkTokenDto {
  token: string;
  telegramUserId: string;
  telegramChatId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
}

@Injectable()
export class TelegramLinkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly api: TelegramApiService,
  ) {}

  // Generate a one-time linking token (called from admin panel)
  async generateLinkToken(tenantId: string, dto: GenerateLinkTokenDto, user: AuthUser) {
    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const cfg = await this.prisma.telegramBotConfig.findFirst({ where: { isActive: true } });
    const botUsername = cfg?.botUsername ?? '';

    await this.prisma.telegramLinkToken.create({
      data: {
        tenantId,
        tokenHash,
        entityType: dto.entityType,
        entityId: dto.entityId,
        intendedRole: dto.intendedRole,
        expiresAt,
        createdByUserId: user.id,
      },
    });

    await this.audit.log(
      user.id,
      'TELEGRAM_LINK_TOKEN_CREATED',
      'TelegramLinkToken',
      dto.entityId,
      { entityType: dto.entityType },
      tenantId,
    );

    const deepLink = botUsername
      ? `https://t.me/${botUsername}?start=${rawToken}`
      : null;

    return { token: rawToken, deepLink, expiresAt };
  }

  // Called when a user opens the deep link in Telegram (/start <token>)
  async consumeLinkToken(dto: ConsumeLinkTokenDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    const linkToken = await this.prisma.telegramLinkToken.findUnique({
      where: { tokenHash },
    });

    if (!linkToken) throw new NotFoundException('Token topilmadi');
    if (linkToken.usedAt) throw new BadRequestException('Token allaqachon ishlatilgan');
    if (linkToken.expiresAt < new Date()) throw new BadRequestException('Token muddati tugagan');

    // Upsert TelegramIdentity
    const identity = await this.prisma.telegramIdentity.upsert({
      where: { telegramUserId: dto.telegramUserId },
      create: {
        telegramUserId: dto.telegramUserId,
        telegramChatId: dto.telegramChatId,
        telegramUsername: dto.telegramUsername,
        firstName: dto.firstName,
        lastName: dto.lastName,
        languageCode: dto.languageCode,
        lastSeenAt: new Date(),
      },
      update: {
        telegramChatId: dto.telegramChatId,
        telegramUsername: dto.telegramUsername,
        firstName: dto.firstName,
        lastName: dto.lastName,
        lastSeenAt: new Date(),
        isBlocked: false,
        isActive: true,
      },
    });

    // Create or update TelegramLink
    await this.prisma.telegramLink.upsert({
      where: {
        tenantId_entityType_entityId: {
          tenantId: linkToken.tenantId,
          entityType: linkToken.entityType,
          entityId: linkToken.entityId,
        },
      },
      create: {
        tenantId: linkToken.tenantId,
        telegramIdentityId: identity.id,
        entityType: linkToken.entityType,
        entityId: linkToken.entityId,
        linkSource: TgLinkSource.TOKEN,
        verified: true,
        linkedByUserId: linkToken.createdByUserId,
      },
      update: {
        telegramIdentityId: identity.id,
        linkSource: TgLinkSource.TOKEN,
        verified: true,
      },
    });

    // Mark token as used
    await this.prisma.telegramLinkToken.update({
      where: { id: linkToken.id },
      data: { usedAt: new Date(), usedByTelegramIdentityId: identity.id },
    });

    await this.audit.log(
      linkToken.createdByUserId ?? undefined,
      'TELEGRAM_LINK_CREATED',
      'TelegramLink',
      linkToken.entityId,
      { entityType: linkToken.entityType, telegramUserId: dto.telegramUserId },
      linkToken.tenantId,
    );

    return { success: true, identityId: identity.id };
  }

  // Unlink a Telegram account
  async unlink(tenantId: string, entityType: TgLinkEntityType, entityId: string, user: AuthUser) {
    const link = await this.prisma.telegramLink.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    });
    if (!link) throw new NotFoundException('Link topilmadi');

    await this.prisma.telegramLink.delete({ where: { id: link.id } });

    await this.audit.log(
      user.id,
      'TELEGRAM_LINK_REMOVED',
      'TelegramLink',
      entityId,
      { entityType },
      tenantId,
    );

    return { success: true };
  }

  // List all linked accounts for a tenant
  async getLinkedAccounts(tenantId: string) {
    return this.prisma.telegramLink.findMany({
      where: { tenantId },
      include: { telegramIdentity: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Send a test message to a linked account
  async sendTestToLinked(linkId: string, user: AuthUser) {
    const link = await this.prisma.telegramLink.findUnique({
      where: { id: linkId },
      include: { telegramIdentity: true },
    });
    if (!link) throw new NotFoundException('Link topilmadi');

    const result = await this.api.sendMessage({
      chatId: link.telegramIdentity.telegramChatId,
      text: `<b>Test xabar</b>\n\nUlangan hisob tekshirildi.\nYuboruvchi: <code>${user.username}</code>`,
      parseMode: 'HTML',
    });

    return result;
  }
}
