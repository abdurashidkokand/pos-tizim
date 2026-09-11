import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../db/prisma.service';
import type { AuthUser } from '@pos/shared';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getMyBilling(user: AuthUser) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId! },
      include: {
        subscription: { include: { plan: true } },
        _count: {
          select: {
            users: { where: { isActive: true } },
            products: { where: { isActive: true } },
            branches: { where: { isActive: true } },
            registers: { where: { isActive: true } },
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException("Do'kon topilmadi");

    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usage = await this.prisma.usageMonthly.findUnique({
      where: { tenantId_month: { tenantId: user.tenantId!, month: currentMonth } },
    });

    // Get open invoices
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId: user.tenantId! },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const plan = tenant.subscription?.plan;
    return {
      plan: plan ? {
        name: plan.name,
        displayName: plan.displayName,
        priceMonthly: plan.priceMonthly,
      } : null,
      subscription: tenant.subscription ? {
        status: tenant.subscription.status,
        trialEndsAt: tenant.subscription.trialEndsAt,
        currentPeriodStart: tenant.subscription.currentPeriodStart,
        currentPeriodEnd: tenant.subscription.currentPeriodEnd,
      } : null,
      usage: {
        users: tenant._count.users,
        products: tenant._count.products,
        branches: tenant._count.branches,
        registers: tenant._count.registers,
        monthlyReceipts: usage?.receiptsCount ?? 0,
      },
      limits: plan ? {
        maxUsers: plan.maxUsers,
        maxProducts: plan.maxProducts,
        maxBranches: plan.maxBranches,
        maxRegisters: plan.maxRegisters,
        monthlyReceipts: plan.monthlyReceipts,
        maxCashiers: plan.maxCashiers,
      } : null,
      features: (plan?.features ?? {}) as Record<string, boolean>,
      invoices,
    };
  }

  async subscribe(user: AuthUser, body: { planCode: string }) {
    const plan = await this.prisma.plan.findUnique({
      where: { name: body.planCode },
    });
    if (!plan) throw new NotFoundException('Tarif topilmadi');
    if (plan.priceMonthly === 0) {
      throw new ForbiddenException("Bepul tarifga o'tish uchun support bilan bog'laning");
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Upsert subscription
    const subscription = await this.prisma.subscription.upsert({
      where: { tenantId: user.tenantId! },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      create: {
        tenantId: user.tenantId!,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: user.tenantId!,
        subscriptionId: subscription.id,
        amountUZS: plan.priceMonthly,
        status: 'OPEN',
        description: `${plan.displayName} tarif — 1 oylik`,
      },
    });

    // Generate payment link
    const paymentLink = this.generatePaymentLink(invoice.id, plan.priceMonthly);

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { paymentLink },
    });

    return {
      subscription,
      invoice: { ...invoice, paymentLink },
      paymentLink,
    };
  }

  async getInvoicePayLink(user: AuthUser, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: user.tenantId! },
    });
    if (!invoice) throw new NotFoundException('Faktura topilmadi');

    if (invoice.status === 'PAID') {
      throw new ForbiddenException("Bu faktura allaqachon to'langan");
    }

    if (invoice.paymentLink) {
      return { paymentLink: invoice.paymentLink };
    }

    const paymentLink = this.generatePaymentLink(invoice.id, invoice.amountUZS);
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { paymentLink },
    });

    return { paymentLink };
  }

  private generatePaymentLink(invoiceId: string, amountUZS: number): string {
    const checkoutUrl = this.config.get('PAYCOM_CHECKOUT_URL') || 'https://checkout.paycom.uz';
    const merchantId = this.config.get('PAYCOM_MERCHANT_ID') || 'MERCHANT_ID';
    const accountField = this.config.get('PAYCOM_ACCOUNT_FIELD') || 'invoice_id';
    const returnUrl = this.config.get('PAYCOM_RETURN_URL') || 'http://localhost:3000/billing/return';

    const amountTiyins = amountUZS * 100;
    const params = `m=${merchantId};ac.${accountField}=${invoiceId};a=${amountTiyins};l=uz;c=${returnUrl}`;
    const encoded = Buffer.from(params).toString('base64');

    return `${checkoutUrl}/${encoded}`;
  }

  // Webhook stub — for future Paycom integration
  async handleWebhook(body: unknown) {
    // TODO: Verify signature, process payment confirmation
    return { ok: true };
  }
}
