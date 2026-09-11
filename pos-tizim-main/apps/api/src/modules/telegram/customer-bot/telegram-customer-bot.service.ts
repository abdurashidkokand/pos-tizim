import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../db/prisma.service';
import { TelegramNotificationsService } from '../notifications/telegram-notifications.service';
import { TgAudience } from '@prisma/client';
import { EVENTS } from '../events/domain-events';
import type { SaleCreatedEvent } from '../events/domain-events';

@Injectable()
export class TelegramCustomerBotService {
  private readonly logger = new Logger(TelegramCustomerBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TelegramNotificationsService,
  ) {}

  private fmt(n: number): string {
    return n.toLocaleString('uz-UZ');
  }

  private async isCustomerBotEnabled(tenantId: string): Promise<boolean> {
    const s = await this.prisma.telegramTenantSettings.findUnique({
      where: { tenantId },
      select: { enabled: true, customerBotEnabled: true },
    });
    return !!(s?.enabled && s.customerBotEnabled);
  }

  @OnEvent(EVENTS.SALE_CREATED)
  async onSaleCreated(evt: SaleCreatedEvent) {
    try {
      if (!evt.customerId) return;
      if (!evt.tenantId || !(await this.isCustomerBotEnabled(evt.tenantId))) return;

      const settings = await this.prisma.telegramTenantSettings.findUnique({
        where: { tenantId: evt.tenantId },
        select: { customerReceiptMessage: true, customerCashbackNotif: true },
      });

      if (!settings?.customerReceiptMessage && !settings?.customerCashbackNotif) return;

      // Find linked Telegram identity for this customer
      const link = await this.prisma.telegramLink.findFirst({
        where: {
          tenantId: evt.tenantId,
          entityType: 'CUSTOMER',
          entityId: evt.customerId,
          verified: true,
          telegramIdentity: { isBlocked: false, isActive: true },
        },
        include: { telegramIdentity: true },
      });

      if (!link) return;

      const customer = await this.prisma.customer.findUnique({
        where: { id: evt.customerId },
        select: { name: true },
      });

      const customerName = customer?.name ?? 'Hurmatli mijoz';

      // Receipt message
      if (settings?.customerReceiptMessage) {
        let text =
          `🧾 <b>Xaridingiz uchun rahmat, ${customerName}!</b>\n\n` +
          `📄 Chek: #${evt.receiptNo}\n` +
          `💰 Jami: <b>${this.fmt(evt.total)}</b> so'm`;

        if (evt.discount > 0) {
          text += `\n🏷 Chegirma: ${this.fmt(evt.discount)} so'm`;
        }

        await this.notifications.enqueue({
          tenantId: evt.tenantId,
          notificationType: 'CUSTOMER_PURCHASE_RECEIPT',
          audience: TgAudience.CUSTOMER,
          telegramIdentityId: link.telegramIdentityId,
          payloadJson: { text, receiptNo: evt.receiptNo },
          dedupeKey: `receipt:${evt.saleId}`,
        });
      }

      // Cashback notification
      if (settings?.customerCashbackNotif) {
        const cashbackCard = await this.prisma.cashbackCard.findFirst({
          where: { tenantId: evt.tenantId, customerId: evt.customerId, isActive: true },
          select: { balance: true },
        });

        if (cashbackCard) {
          const cashbackText =
            `💳 <b>Cashback balansingiz:</b> <b>${this.fmt(cashbackCard.balance)}</b> so'm\n` +
            `Keyingi xaridda ishlatishingiz mumkin!`;

          await this.notifications.enqueue({
            tenantId: evt.tenantId,
            notificationType: 'CUSTOMER_BONUS_EARNED',
            audience: TgAudience.CUSTOMER,
            telegramIdentityId: link.telegramIdentityId,
            payloadJson: { text: cashbackText },
            dedupeKey: `cashback_notif:${evt.saleId}`,
          });
        }
      }
    } catch (e) {
      this.logger.warn('onSaleCreated customer flow failed', e);
    }
  }

  // Send loyalty balance on demand (called from webhook /balance command)
  async sendLoyaltyInfo(telegramIdentityId: string, tenantId: string, customerId: string): Promise<void> {
    try {
      const [customer, cashbackCard] = await Promise.all([
        this.prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } }),
        this.prisma.cashbackCard.findFirst({
          where: { tenantId, customerId, isActive: true },
          select: { balance: true, totalEarned: true, totalSpent: true, cardNumber: true },
        }),
      ]);

      if (!cashbackCard) {
        await this.notifications.enqueue({
          tenantId,
          notificationType: 'CUSTOMER_LOYALTY_INFO',
          audience: TgAudience.CUSTOMER,
          telegramIdentityId,
          payloadJson: {
            text: `👋 Salom, ${customer?.name ?? 'Hurmatli mijoz'}!\n\nSizda hali cashback kartasi yo'q. Do'kondan xarid qilib boshlang! 🛒`,
          },
        });
        return;
      }

      const text =
        `👤 <b>${customer?.name ?? 'Mijoz'}</b>\n\n` +
        `💳 Karta: #${cashbackCard.cardNumber}\n` +
        `💰 Balans: <b>${this.fmt(cashbackCard.balance)}</b> so'm\n` +
        `📈 Jami yig'ildi: ${this.fmt(cashbackCard.totalEarned)} so'm\n` +
        `📉 Jami sarflandi: ${this.fmt(cashbackCard.totalSpent)} so'm`;

      await this.notifications.enqueue({
        tenantId,
        notificationType: 'CUSTOMER_LOYALTY_INFO',
        audience: TgAudience.CUSTOMER,
        telegramIdentityId,
        payloadJson: { text },
      });
    } catch (e) {
      this.logger.warn('sendLoyaltyInfo failed', e);
    }
  }
}
