import { Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { TgAudience, TgParseMode } from '@prisma/client';
import type { AuthUser } from '@pos/shared';

export interface TemplateVariables {
  store_name?: string;
  branch_name?: string;
  customer_name?: string;
  receipt_no?: string;
  sale_total?: string | number;
  bonus_earned?: string | number;
  bonus_balance?: string | number;
  stamp_progress?: string | number;
  product_name?: string;
  stock_qty?: string | number;
  [key: string]: string | number | undefined;
}

@Injectable()
export class TelegramTemplatesService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.seedDefaults();
    } catch {
      // non-fatal: DB may not be ready on first cold start before migration
    }
  }

  async findAll(tenantId?: string) {
    return this.prisma.telegramMessageTemplate.findMany({
      where: {
        OR: [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])],
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
  }

  async findByCode(code: string, tenantId?: string): Promise<{ bodyTemplate: string; parseMode: TgParseMode } | null> {
    // Try tenant override first
    if (tenantId) {
      const override = await this.prisma.telegramMessageTemplate.findFirst({
        where: { code, tenantId, isActive: true },
      });
      if (override) return override;
    }
    // Fall back to global
    return this.prisma.telegramMessageTemplate.findFirst({
      where: { code, tenantId: null, isDefault: true, isActive: true },
    });
  }

  render(template: string, vars: TemplateVariables): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const val = vars[key];
      return val !== undefined ? String(val) : `{{${key}}}`;
    });
  }

  async create(data: {
    code: string;
    audience: TgAudience;
    language?: string;
    titleTemplate?: string;
    bodyTemplate: string;
    parseMode?: TgParseMode;
    inlineKeyboardJson?: string;
    tenantId?: string;
  }, user: AuthUser) {
    const template = await this.prisma.telegramMessageTemplate.create({
      data: {
        code: data.code,
        audience: data.audience,
        language: data.language ?? 'uz',
        titleTemplate: data.titleTemplate,
        bodyTemplate: data.bodyTemplate,
        parseMode: data.parseMode ?? TgParseMode.HTML,
        inlineKeyboardJson: data.inlineKeyboardJson,
        tenantId: data.tenantId ?? null,
        isDefault: !data.tenantId,
      },
    });

    await this.audit.log(user.id, 'CREATE_TG_TEMPLATE', 'TelegramMessageTemplate', template.id, {
      code: data.code,
      audience: data.audience,
    }, user.tenantId);

    return template;
  }

  async update(id: string, data: Partial<{
    titleTemplate: string;
    bodyTemplate: string;
    parseMode: TgParseMode;
    inlineKeyboardJson: string;
    isActive: boolean;
  }>, user: AuthUser) {
    const template = await this.prisma.telegramMessageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template topilmadi');

    const updated = await this.prisma.telegramMessageTemplate.update({
      where: { id },
      data,
    });

    await this.audit.log(user.id, 'UPDATE_TG_TEMPLATE', 'TelegramMessageTemplate', id, data as any, user.tenantId);
    return updated;
  }

  async preview(id: string, vars: TemplateVariables) {
    const template = await this.prisma.telegramMessageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template topilmadi');
    return {
      rendered: this.render(template.bodyTemplate, vars),
      parseMode: template.parseMode,
      raw: template.bodyTemplate,
    };
  }

  // Seed default global templates — idempotent
  async seedDefaults(): Promise<void> {
    const defaults: Array<{
      code: string;
      audience: TgAudience;
      bodyTemplate: string;
    }> = [
      {
        code: 'owner.daily_summary',
        audience: TgAudience.OWNER,
        bodyTemplate:
          `📊 <b>Kunlik hisobot — {{date}}</b>\n\n` +
          `🛒 Sotuvlar: <b>{{sale_count}}</b> ta\n` +
          `💰 Tushum: <b>{{sale_total}}</b> so'm\n` +
          `📈 Foyda: <b>{{gross_profit}}</b> so'm`,
      },
      {
        code: 'owner.low_stock',
        audience: TgAudience.OWNER,
        bodyTemplate:
          `⚠️ <b>Kam qolgan mahsulot!</b>\n` +
          `📦 {{product_name}}\n` +
          `📊 Qoldi: <b>{{stock_qty}}</b> ta`,
      },
      {
        code: 'owner.out_of_stock',
        audience: TgAudience.OWNER,
        bodyTemplate:
          `🚨 <b>Mahsulot tugadi!</b>\n` +
          `📦 {{product_name}}\nOmborda 0 ta qoldi.`,
      },
      {
        code: 'owner.debt_created',
        audience: TgAudience.OWNER,
        bodyTemplate:
          `🧾 <b>Yangi qarz!</b>\n` +
          `👤 Mijoz: {{customer_name}}\n` +
          `📄 Chek: #{{receipt_no}}\n` +
          `💰 Qarz: {{sale_total}} so'm`,
      },
      {
        code: 'owner.cash_session_opened',
        audience: TgAudience.OWNER,
        bodyTemplate:
          `🟢 <b>Kassa sessiya ochildi</b>\n` +
          `👤 Kassir: {{cashier_name}}\n` +
          `💵 Boshlang'ich: {{opening_cash}} so'm`,
      },
      {
        code: 'owner.cash_session_closed',
        audience: TgAudience.OWNER,
        bodyTemplate:
          `🔴 <b>Kassa sessiya yopildi</b>\n` +
          `👤 Kassir: {{cashier_name}}\n` +
          `💵 Yopilish: {{closing_cash}} so'm`,
      },
      {
        code: 'customer.link_success',
        audience: TgAudience.CUSTOMER,
        bodyTemplate:
          `✅ <b>Telegram muvaffaqiyatli ulandi!</b>\n\n` +
          `Salom, {{customer_name}}! 👋\n` +
          `Endi xaridlaringizdan keyin chek va bonus ma'lumotlarini shu yerda olasiz.`,
      },
      {
        code: 'customer.purchase_receipt',
        audience: TgAudience.CUSTOMER,
        bodyTemplate:
          `🧾 <b>Xaridingiz uchun rahmat, {{customer_name}}!</b>\n\n` +
          `📄 Chek: #{{receipt_no}}\n` +
          `💰 Jami: <b>{{sale_total}}</b> so'm`,
      },
      {
        code: 'customer.bonus_earned',
        audience: TgAudience.CUSTOMER,
        bodyTemplate:
          `💳 <b>Cashback balansingiz:</b> <b>{{bonus_balance}}</b> so'm\n` +
          `Keyingi xaridda ishlatishingiz mumkin!`,
      },
      {
        code: 'customer.bonus_expiring',
        audience: TgAudience.CUSTOMER,
        bodyTemplate:
          `⏰ <b>Bonuslaringiz muddati tugayapti!</b>\n\n` +
          `💰 Miqdor: <b>{{bonus_balance}}</b> so'm\n` +
          `📅 Muddati: {{expiry_date}}\n` +
          `Tezroq foydalaning! 🛒`,
      },
    ];

    for (const d of defaults) {
      const exists = await this.prisma.telegramMessageTemplate.findFirst({
        where: { code: d.code, tenantId: null, isDefault: true },
      });
      if (!exists) {
        await this.prisma.telegramMessageTemplate.create({
          data: {
            code: d.code,
            audience: d.audience,
            language: 'uz',
            bodyTemplate: d.bodyTemplate,
            parseMode: TgParseMode.HTML,
            tenantId: null,
            isDefault: true,
            isActive: true,
          },
        });
      }
    }
  }
}
