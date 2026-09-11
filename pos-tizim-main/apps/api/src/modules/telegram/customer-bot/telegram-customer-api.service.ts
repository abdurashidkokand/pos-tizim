import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';
import { TgLinkEntityType } from '@prisma/client';

@Injectable()
export class TelegramCustomerApiService {
  private readonly logger = new Logger(TelegramCustomerApiService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Resolve tenantId + customerId from a verified JWT user
  private async resolveCustomer(userId: string, tenantId: string) {
    // A customer may have a User account OR just be in the Customer table
    // Try Customer record linked to this userId / entityId
    const link = await this.prisma.telegramLink.findFirst({
      where: { tenantId, entityId: userId, entityType: TgLinkEntityType.CUSTOMER },
      include: { telegramIdentity: { select: { telegramChatId: true } } },
    });
    return link;
  }

  async getMe(tenantId: string, entityId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: entityId, tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
        cashbackCards: {
          where: { isActive: true },
          select: {
            id: true,
            cardNumber: true,
            balance: true,
            totalEarned: true,
            totalSpent: true,
          },
          take: 1,
        },
      },
    });

    if (!customer) throw new NotFoundException('Mijoz topilmadi');

    const link = await this.prisma.telegramLink.findFirst({
      where: { tenantId, entityId, entityType: TgLinkEntityType.CUSTOMER },
      include: {
        telegramIdentity: {
          select: {
            telegramUsername: true,
            firstName: true,
            lastName: true,
            telegramChatId: true,
            lastSeenAt: true,
          },
        },
      },
    });

    return {
      ...customer,
      telegramLinked: !!link,
      telegramIdentity: link?.telegramIdentity ?? null,
    };
  }

  async getLoyalty(tenantId: string, entityId: string) {
    const card = await this.prisma.cashbackCard.findFirst({
      where: { tenantId, customerId: entityId, isActive: true },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            amount: true,
            type: true,
            note: true,
            createdAt: true,
          },
        },
      },
    });

    if (!card) return { balance: 0, totalEarned: 0, totalSpent: 0, transactions: [] };

    return {
      cardNumber: card.cardNumber,
      balance: card.balance,
      totalEarned: card.totalEarned,
      totalSpent: card.totalSpent,
      transactions: card.transactions,
    };
  }

  async getReceipts(tenantId: string, entityId: string, limit = 10) {
    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        customer: { id: entityId },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        receiptNo: true,
        total: true,
        discount: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            qty: true,
            price: true,
            product: { select: { name: true } },
          },
          take: 5,
        },
      },
    });

    return sales;
  }

  async generateDeepLink(tenantId: string, entityId: string, entityType: TgLinkEntityType) {
    // Get bot config for username
    const cfg = await this.prisma.telegramBotConfig.findFirst({
      where: { isActive: true },
      select: { botUsername: true },
    });

    // Create a fresh link token
    const crypto = await import('crypto');
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.prisma.telegramLinkToken.create({
      data: {
        tenantId,
        tokenHash,
        entityType,
        entityId,
        expiresAt,
      },
    });

    const deepLink = cfg?.botUsername
      ? `https://t.me/${cfg.botUsername}?start=${rawToken}`
      : null;

    return { token: rawToken, deepLink, expiresAt };
  }
}
