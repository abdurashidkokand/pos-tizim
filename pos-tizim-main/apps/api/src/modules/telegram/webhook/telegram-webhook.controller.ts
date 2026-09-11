import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';
import { TelegramLinkingService } from '../linking/telegram-linking.service';
import { TelegramApiService } from '../core/telegram-api.service';
import { TgLinkEntityType, ReceivableStatus } from '@prisma/client';

interface TgUser {
  id: number;
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: TgUser;
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: TgUser;
    message?: { chat: { id: number } };
    data?: string;
  };
}

@Controller('telegram/webhook')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly linking: TelegramLinkingService,
    private readonly api: TelegramApiService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleUpdate(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
  ) {
    // Validate webhook secret
    const cfg = await this.prisma.telegramBotConfig.findFirst({ where: { isActive: true } });
    if (cfg?.webhookSecret && secretToken !== cfg.webhookSecret) {
      this.logger.warn('Invalid webhook secret — ignoring update');
      return { ok: true };
    }

    try {
      if (update.message?.text) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (e) {
      this.logger.error('Webhook handler error', e);
    }

    return { ok: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Message handler
  // ──────────────────────────────────────────────────────────────────────────

  private async handleMessage(msg: NonNullable<TelegramUpdate['message']>) {
    const text = msg.text ?? '';
    const from = msg.from;
    const chatId = String(msg.chat.id);

    // Upsert identity
    await this.prisma.telegramIdentity.upsert({
      where: { telegramUserId: String(from.id) },
      create: {
        telegramUserId: String(from.id),
        telegramChatId: chatId,
        telegramUsername: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        languageCode: from.language_code,
        isBot: from.is_bot,
        lastSeenAt: new Date(),
      },
      update: {
        telegramChatId: chatId,
        telegramUsername: from.username,
        lastSeenAt: new Date(),
        isBlocked: false,
        isActive: true,
      },
    });

    const cmd = text.split(' ')[0].split('@')[0].toLowerCase();

    switch (cmd) {
      case '/start':
        await this.handleStart(msg);
        break;
      case '/balance':
        await this.handleBalance(chatId, String(from.id));
        break;
      case '/menu':
        await this.handleMenu(chatId, String(from.id));
        break;
      default:
        // Send generic help
        await this.sendHelp(chatId);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  /start [token]
  // ──────────────────────────────────────────────────────────────────────────

  private async handleStart(msg: NonNullable<TelegramUpdate['message']>) {
    const parts = (msg.text ?? '').split(' ');
    const token = parts[1];
    const chatId = String(msg.chat.id);
    const from = msg.from;

    if (token) {
      try {
        await this.linking.consumeLinkToken({
          token,
          telegramUserId: String(from.id),
          telegramChatId: chatId,
          telegramUsername: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
          languageCode: from.language_code,
        });
        this.logger.log(`Telegram account linked: userId=${from.id}`);

        const name = from.first_name ?? 'Foydalanuvchi';
        await this.api.sendMessage({
          chatId,
          text:
            `<b>[OK] Muvaffaqiyatli ulandi!</b>\n\n` +
            `Salom, <b>${name}</b>! POS botiga xush kelibsiz.\n\n` +
            `<b>Mavjud buyruqlar:</b>\n` +
            `▸ /balance — bonus balans\n` +
            `▸ /menu — asosiy menyu`,
          parseMode: 'HTML',
        });

        // Check if customer — show balance on first link
        const customerLink = await this.getCustomerLink(String(from.id));
        if (customerLink) {
          await this.handleBalance(chatId, String(from.id));
        }
      } catch (e: unknown) {
        this.logger.warn('Token consume failed', String(e));
        await this.api.sendMessage({
          chatId,
          text: `<b>[!]</b> Havola yaroqsiz yoki muddati o'tgan. Yangi havola oling.`,
          parseMode: 'HTML',
        });
      }
    } else {
      // No token — check if already linked
      const identity = await this.prisma.telegramIdentity.findUnique({
        where: { telegramUserId: String(from.id) },
        include: { links: { take: 1 } },
      });

      if (identity?.links?.length) {
        await this.handleMenu(chatId, String(from.id));
      } else {
        await this.api.sendMessage({
          chatId,
          text:
            `Salom! Bu POS tizimining Telegram boti.\n\n` +
            `Botni ulash uchun POS tizimidagi maxsus havoladan foydalaning.`,
          parseMode: 'HTML',
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  /balance
  // ──────────────────────────────────────────────────────────────────────────

  private async handleBalance(chatId: string, telegramUserId: string) {
    const identity = await this.prisma.telegramIdentity.findUnique({
      where: { telegramUserId },
      include: {
        links: {
          where: { entityType: TgLinkEntityType.CUSTOMER },
          take: 1,
        },
      },
    });

    if (!identity?.links?.length) {
      await this.api.sendMessage({
        chatId,
        text: `[i] Sizning akkauntingiz hali ulanmagan.`,
        parseMode: 'HTML',
      });
      return;
    }

    const link = identity.links[0];
    const card = await this.prisma.cashbackCard.findFirst({
      where: { customerId: link.entityId, isActive: true },
      include: { customer: { select: { name: true } } },
    });

    if (!card) {
      await this.api.sendMessage({
        chatId,
        text: `[i] Sizning cashback kartangiz topilmadi.`,
        parseMode: 'HTML',
      });
      return;
    }

    await this.api.sendMessage({
      chatId,
      text:
        `<b>◆ Bonus balansingiz</b>\n` +
        `——————————————\n` +
        `Mijoz: <b>${card.customer.name}</b>\n` +
        `Balans: <b>${card.balance.toLocaleString('uz-UZ')} so'm</b>\n` +
        `Jami yig'ilgan: ${card.totalEarned.toLocaleString('uz-UZ')} so'm\n` +
        `Jami ishlatilgan: ${card.totalSpent.toLocaleString('uz-UZ')} so'm`,
      parseMode: 'HTML',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  /menu — inline keyboard based on linked entity type
  // ──────────────────────────────────────────────────────────────────────────

  private async handleMenu(chatId: string, telegramUserId: string) {
    const identity = await this.prisma.telegramIdentity.findUnique({
      where: { telegramUserId },
      include: {
        links: { where: {}, take: 1 },
      },
    });

    if (!identity?.links?.length) {
      await this.sendHelp(chatId);
      return;
    }

    const link = identity.links[0];

    if (link.entityType === TgLinkEntityType.CUSTOMER) {
      await this.api.sendMessage({
        chatId,
        text: `<b>◆ Mijoz menyusi</b>`,
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [
            [{ text: '[ Bonus balansi ]', callback_data: 'cb:my_balance' }],
            [{ text: '[ So\'ngi xaridlar ]', callback_data: 'cb:my_purchases' }],
            [{ text: '[ Do\'kon haqida ]', callback_data: 'cb:store_info' }],
          ],
        },
      });
    } else {
      // Owner / Staff menu
      await this.api.sendMessage({
        chatId,
        text: `<b>◆ Boshqaruv menyusi</b>`,
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [
            [{ text: '[ Bugungi statistika ]', callback_data: 'cb:today_stats' }],
            [{ text: '[ Kam qolgan mahsulotlar ]', callback_data: 'cb:low_stock' }],
            [{ text: '[ Muddati o\'tgan qarzlar ]', callback_data: 'cb:overdue_debts' }],
            [{ text: '[ Haftalik hisobot ]', callback_data: 'cb:week_stats' }],
            [{ text: '[ Oxirgi sotuvlar ]', callback_data: 'cb:recent_sales' }],
          ],
        },
      });
    }
  }

  private async sendHelp(chatId: string) {
    await this.api.sendMessage({
      chatId,
      text:
        `<b>Mavjud buyruqlar:</b>\n` +
        `▸ /balance — bonus balans\n` +
        `▸ /menu — asosiy menyu`,
      parseMode: 'HTML',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Callback query handler
  // ──────────────────────────────────────────────────────────────────────────

  private async handleCallbackQuery(cb: NonNullable<TelegramUpdate['callback_query']>) {
    const chatId = cb.message?.chat.id ? String(cb.message.chat.id) : null;
    if (!chatId) return;

    const data = cb.data ?? '';

    switch (data) {
      case 'cb:my_balance':
        await this.handleBalance(chatId, String(cb.from.id));
        break;

      case 'cb:my_purchases':
        await this.handleRecentPurchases(chatId, String(cb.from.id));
        break;

      case 'cb:store_info':
        await this.handleStoreInfo(chatId, String(cb.from.id));
        break;

      case 'cb:today_stats':
        await this.handleTodayStats(chatId, String(cb.from.id));
        break;

      case 'cb:low_stock':
        await this.handleLowStockCallback(chatId, String(cb.from.id));
        break;

      case 'cb:overdue_debts':
        await this.handleOverdueDebtsCallback(chatId, String(cb.from.id));
        break;

      case 'cb:week_stats':
        await this.handleWeekStats(chatId, String(cb.from.id));
        break;

      case 'cb:recent_sales':
        await this.handleRecentSalesOwner(chatId, String(cb.from.id));
        break;

      default:
        this.logger.debug(`Unknown callback data: ${data}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Callback handlers
  // ──────────────────────────────────────────────────────────────────────────

  private async handleRecentPurchases(chatId: string, telegramUserId: string) {
    const link = await this.getCustomerLink(telegramUserId);
    if (!link) {
      await this.api.sendMessage({ chatId, text: `[i] Akkaunt ulanmagan.`, parseMode: 'HTML' });
      return;
    }

    const sales = await this.prisma.sale.findMany({
      where: { tenantId: link.tenantId, customer: { id: link.entityId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { receiptNo: true, total: true, createdAt: true, status: true },
    });

    if (!sales.length) {
      await this.api.sendMessage({ chatId, text: `[i] Xaridlar tarixi yo'q.`, parseMode: 'HTML' });
      return;
    }

    const lines = sales.map(
      (s) =>
        `▸ ${s.receiptNo} — <b>${s.total.toLocaleString('uz-UZ')} so'm</b>\n  Sana: ${new Date(s.createdAt).toLocaleDateString('uz-UZ')}`,
    );

    await this.api.sendMessage({
      chatId,
      text: `<b>◆ So'ngi xaridlar</b>\n——————————————\n${lines.join('\n\n')}`,
      parseMode: 'HTML',
    });
  }

  private async handleStoreInfo(chatId: string, telegramUserId: string) {
    const link = await this.getCustomerLink(telegramUserId);
    if (!link) {
      await this.api.sendMessage({ chatId, text: `[i] Akkaunt ulanmagan.`, parseMode: 'HTML' });
      return;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: link.tenantId },
      select: { name: true, phone: true, address: true },
    });

    if (!tenant) return;

    await this.api.sendMessage({
      chatId,
      text:
        `<b>◆ ${tenant.name}</b>\n` +
        `——————————————\n` +
        (tenant.phone ? `Tel: ${tenant.phone}\n` : '') +
        (tenant.address ? `Manzil: ${tenant.address}` : ''),
      parseMode: 'HTML',
    });
  }

  private async handleTodayStats(chatId: string, telegramUserId: string) {
    const link = await this.getOwnerLink(telegramUserId);
    if (!link) {
      await this.api.sendMessage({ chatId, text: `[i] Akkaunt ulanmagan yoki bu funksiya mavjud emas.`, parseMode: 'HTML' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await this.prisma.sale.aggregate({
      where: { tenantId: link.tenantId, createdAt: { gte: today } },
      _sum: { total: true, grossProfit: true },
      _count: { id: true },
    });

    await this.api.sendMessage({
      chatId,
      text:
        `<b>◆ Bugungi statistika</b>\n` +
        `——————————————\n` +
        `Sotuvlar: <b>${stats._count.id} ta</b>\n` +
        `Tushum: <b>${(stats._sum.total ?? 0).toLocaleString('uz-UZ')} so'm</b>\n` +
        `Foyda: <b>${(stats._sum.grossProfit ?? 0).toLocaleString('uz-UZ')} so'm</b>`,
      parseMode: 'HTML',
    });
  }

  private async handleLowStockCallback(chatId: string, telegramUserId: string) {
    const link = await this.getOwnerLink(telegramUserId);
    if (!link) {
      await this.api.sendMessage({ chatId, text: `[i] Akkaunt ulanmagan.`, parseMode: 'HTML' });
      return;
    }

    const stocks = await this.prisma.stock.findMany({
      where: { quantity: { lte: 5 }, product: { tenantId: link.tenantId } },
      include: { product: { select: { name: true } } },
      orderBy: { quantity: 'asc' },
      take: 10,
    });

    if (!stocks.length) {
      await this.api.sendMessage({ chatId, text: `<b>[OK]</b> Barcha mahsulotlar yetarli.`, parseMode: 'HTML' });
      return;
    }

    const lines = stocks.map((s) => `▸ ${s.product.name} — <b>${s.quantity} ta</b>`).join('\n');
    await this.api.sendMessage({
      chatId,
      text: `<b>[!] Kam qolgan mahsulotlar</b>\n——————————————\n${lines}`,
      parseMode: 'HTML',
    });
  }

  private async handleOverdueDebtsCallback(chatId: string, telegramUserId: string) {
    const link = await this.getOwnerLink(telegramUserId);
    if (!link) {
      await this.api.sendMessage({ chatId, text: `[i] Akkaunt ulanmagan.`, parseMode: 'HTML' });
      return;
    }

    const debts = await this.prisma.receivable.findMany({
      where: { status: ReceivableStatus.OPEN, dueDate: { lt: new Date() }, tenantId: link.tenantId },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    if (!debts.length) {
      await this.api.sendMessage({ chatId, text: `<b>[OK]</b> Muddati o'tgan qarzlar yo'q.`, parseMode: 'HTML' });
      return;
    }

    const lines = debts
      .map((d) => `▸ ${d.customer.name} — <b>${(d.amountDue - d.amountPaid).toLocaleString('uz-UZ')} so'm</b>`)
      .join('\n');

    await this.api.sendMessage({
      chatId,
      text: `<b>[!] Muddati o'tgan qarzlar</b>\n——————————————\n${lines}`,
      parseMode: 'HTML',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async handleWeekStats(chatId: string, telegramUserId: string) {
    const link = await this.getOwnerLink(telegramUserId);
    if (!link) {
      await this.api.sendMessage({ chatId, text: `[i] Akkaunt ulanmagan.`, parseMode: 'HTML' });
      return;
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const stats = await this.prisma.sale.aggregate({
      where: { tenantId: link.tenantId, createdAt: { gte: weekAgo } },
      _sum: { total: true, grossProfit: true },
      _count: { id: true },
    });

    // Top 3 products by quantity sold this week
    const recentItems = await this.prisma.saleItem.findMany({
      where: { sale: { tenantId: link.tenantId, createdAt: { gte: weekAgo } } },
      select: { productId: true, qty: true },
    });
    const productIds = [...new Set(recentItems.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(products.map((p) => [p.id, p.name]));
    const productMap = new Map<string, { name: string; qty: number }>();
    for (const item of recentItems) {
      const existing = productMap.get(item.productId);
      if (existing) existing.qty += item.qty;
      else productMap.set(item.productId, { name: nameMap.get(item.productId) ?? 'Noma\'lum', qty: item.qty });
    }
    const topLines = [...productMap.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3)
      .map((p) => `▸ ${p.name} — ${p.qty} ta`)
      .join('\n');

    await this.api.sendMessage({
      chatId,
      text:
        `<b>◆ Haftalik hisobot</b>\n` +
        `——————————————\n` +
        `Sotuvlar: <b>${stats._count.id} ta</b>\n` +
        `Tushum: <b>${(stats._sum.total ?? 0).toLocaleString('uz-UZ')} so'm</b>\n` +
        `Foyda: <b>${(stats._sum.grossProfit ?? 0).toLocaleString('uz-UZ')} so'm</b>\n\n` +
        (topLines ? `<b>Ko'p sotilgan mahsulotlar:</b>\n${topLines}` : ''),
      parseMode: 'HTML',
    });
  }

  private async handleRecentSalesOwner(chatId: string, telegramUserId: string) {
    const link = await this.getOwnerLink(telegramUserId);
    if (!link) {
      await this.api.sendMessage({ chatId, text: `[i] Akkaunt ulanmagan.`, parseMode: 'HTML' });
      return;
    }

    const sales = await this.prisma.sale.findMany({
      where: { tenantId: link.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        receiptNo: true,
        total: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    });

    if (!sales.length) {
      await this.api.sendMessage({ chatId, text: `[i] Sotuvlar topilmadi.`, parseMode: 'HTML' });
      return;
    }

    const lines = sales
      .map(
        (s) =>
          `▸ ${s.receiptNo} — <b>${s.total.toLocaleString('uz-UZ')} so'm</b>\n` +
          `  ${s.customer?.name ?? 'Anonim'} · ${new Date(s.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      )
      .join('\n\n');

    await this.api.sendMessage({
      chatId,
      text: `<b>◆ Oxirgi sotuvlar</b>\n——————————————\n${lines}`,
      parseMode: 'HTML',
    });
  }

  private async getCustomerLink(telegramUserId: string) {
    const identity = await this.prisma.telegramIdentity.findUnique({
      where: { telegramUserId },
      include: { links: { where: { entityType: TgLinkEntityType.CUSTOMER }, take: 1 } },
    });
    return identity?.links?.[0] ?? null;
  }

  private async getOwnerLink(telegramUserId: string) {
    const identity = await this.prisma.telegramIdentity.findUnique({
      where: { telegramUserId },
      include: {
        links: {
          where: {
            entityType: {
              in: [TgLinkEntityType.OWNER, TgLinkEntityType.USER, TgLinkEntityType.STAFF],
            },
          },
          take: 1,
        },
      },
    });
    return identity?.links?.[0] ?? null;
  }
}

