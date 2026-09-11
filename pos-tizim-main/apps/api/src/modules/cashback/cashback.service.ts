import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import type { AuthUser } from '@pos/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CashbackService {
  constructor(private prisma: PrismaService) {}

  // Default cashback rate: 2% of sale total
  private getCashbackRate(tenantId: string): number {
    return 0.02;
  }

  async getCards(query: { search?: string; page?: string; limit?: string }, user: AuthUser) {
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
    const skip = (page - 1) * limit;

    const where: any = { tenantId: user.tenantId };
    if (query.search) {
      where.OR = [
        { cardNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cashbackCard.findMany({
        where,
        include: { customer: { select: { id: true, name: true, phone: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cashbackCard.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCardByNumber(cardNumber: string, user: AuthUser) {
    const card = await this.prisma.cashbackCard.findFirst({
      where: { cardNumber, tenantId: user.tenantId },
      include: {
        customer: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!card) throw new NotFoundException('Karta topilmadi');
    return card;
  }

  async createCard(body: { customerId: string }, user: AuthUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: body.customerId, tenantId: user.tenantId },
    });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');

    // Check if customer already has an active card
    const existing = await this.prisma.cashbackCard.findFirst({
      where: { customerId: body.customerId, tenantId: user.tenantId, isActive: true },
    });
    if (existing) throw new BadRequestException('Mijozda allaqachon karta mavjud');

    const cardNumber = this.generateCardNumber();

    return this.prisma.cashbackCard.create({
      data: {
        tenantId: user.tenantId!,
        customerId: body.customerId,
        cardNumber,
      },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    });
  }

  async earnCashback(cardId: string, saleId: string, saleTotal: number, user: AuthUser) {
    const card = await this.prisma.cashbackCard.findFirst({
      where: { id: cardId, tenantId: user.tenantId, isActive: true },
    });
    if (!card) return null;

    const rate = this.getCashbackRate(user.tenantId!);
    const earned = Math.round(saleTotal * rate);
    if (earned <= 0) return null;

    await this.prisma.$transaction([
      this.prisma.cashbackTransaction.create({
        data: {
          cardId,
          saleId,
          amount: earned,
          type: 'EARN',
          note: `Sotuv uchun ${rate * 100}% cashback`,
        },
      }),
      this.prisma.cashbackCard.update({
        where: { id: cardId },
        data: {
          balance: { increment: earned },
          totalEarned: { increment: earned },
        },
      }),
    ]);

    return { earned, newBalance: card.balance + earned };
  }

  async redeemCashback(
    body: { cardId: string; amount: number },
    user: AuthUser,
  ) {
    const card = await this.prisma.cashbackCard.findFirst({
      where: { id: body.cardId, tenantId: user.tenantId, isActive: true },
    });
    if (!card) throw new NotFoundException('Karta topilmadi');
    if (card.balance < body.amount) {
      throw new BadRequestException(`Yetarli balans yo'q. Mavjud: ${card.balance}`);
    }

    await this.prisma.$transaction([
      this.prisma.cashbackTransaction.create({
        data: {
          cardId: body.cardId,
          amount: body.amount,
          type: 'REDEEM',
          note: "Sotuvda ishlatildi",
        },
      }),
      this.prisma.cashbackCard.update({
        where: { id: body.cardId },
        data: {
          balance: { decrement: body.amount },
          totalSpent: { increment: body.amount },
        },
      }),
    ]);

    return {
      redeemed: body.amount,
      newBalance: card.balance - body.amount,
    };
  }

  async getTransactions(cardId: string, user: AuthUser) {
    const card = await this.prisma.cashbackCard.findFirst({
      where: { id: cardId, tenantId: user.tenantId },
    });
    if (!card) throw new NotFoundException('Karta topilmadi');

    return this.prisma.cashbackTransaction.findMany({
      where: { cardId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private generateCardNumber(): string {
    const prefix = 'CB';
    const num = uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase();
    return `${prefix}-${num.slice(0, 4)}-${num.slice(4, 8)}-${num.slice(8, 12)}`;
  }
}
