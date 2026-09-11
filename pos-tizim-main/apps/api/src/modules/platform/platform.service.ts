import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  async getTenants(query: { status?: string; search?: string; page?: string; limit?: string }) {
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.isActive = query.status === 'active';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          subscription: { include: { plan: true } },
          _count: {
            select: {
              users: { where: { isActive: true } },
              products: { where: { isActive: true } },
              branches: { where: { isActive: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getTenantDetail(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        branches: true,
        users: {
          select: { id: true, username: true, fullName: true, role: true, isActive: true },
        },
        invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: {
          select: {
            users: { where: { isActive: true } },
            products: { where: { isActive: true } },
            sales: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant topilmadi');
    return tenant;
  }

  async updateTenant(
    id: string,
    body: {
      isActive?: boolean;
      extendTrialDays?: number;
      changePlanCode?: string;
      makeVip?: boolean;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { subscription: true },
    });
    if (!tenant) throw new NotFoundException('Tenant topilmadi');

    // Update tenant status
    if (body.isActive !== undefined) {
      await this.prisma.tenant.update({
        where: { id },
        data: { isActive: body.isActive },
      });

      if (tenant.subscription) {
        await this.prisma.subscription.update({
          where: { id: tenant.subscription.id },
          data: { status: body.isActive ? 'ACTIVE' : 'SUSPENDED' },
        });
      }
    }

    // Extend trial
    if (body.extendTrialDays && tenant.subscription) {
      const currentEnd = tenant.subscription.trialEndsAt || new Date();
      const newEnd = new Date(currentEnd);
      newEnd.setDate(newEnd.getDate() + body.extendTrialDays);

      await this.prisma.subscription.update({
        where: { id: tenant.subscription.id },
        data: { trialEndsAt: newEnd, status: 'TRIAL' },
      });
    }

    // Change plan
    if (body.changePlanCode) {
      const plan = await this.prisma.plan.findUnique({
        where: { name: body.changePlanCode },
      });
      if (!plan) throw new NotFoundException('Tarif topilmadi');

      if (tenant.subscription) {
        await this.prisma.subscription.update({
          where: { id: tenant.subscription.id },
          data: { planId: plan.id, status: 'ACTIVE' },
        });
      } else {
        await this.prisma.subscription.create({
          data: {
            tenantId: id,
            planId: plan.id,
            status: 'ACTIVE',
          },
        });
      }
    }

    // Make VIP — assign or create VIP plan with unlimited limits
    if (body.makeVip) {
      let vipPlan = await this.prisma.plan.findUnique({ where: { name: 'VIP' } });
      if (!vipPlan) {
        vipPlan = await this.prisma.plan.create({
          data: {
            name: 'VIP',
            displayName: 'VIP (Cheksiz)',
            priceMonthly: 0,
            priceYearly: 0,
            maxBranches: 999999,
            maxUsers: 999999,
            maxCashiers: 999999,
            maxRegisters: 999999,
            maxProducts: 999999,
            monthlyReceipts: 999999,
            storageMB: 999999,
            sortOrder: 999,
          },
        });
      }

      if (tenant.subscription) {
        await this.prisma.subscription.update({
          where: { id: tenant.subscription.id },
          data: { planId: vipPlan.id, status: 'ACTIVE' },
        });
      } else {
        await this.prisma.subscription.create({
          data: {
            tenantId: id,
            planId: vipPlan.id,
            status: 'ACTIVE',
          },
        });
      }

      await this.prisma.tenant.update({
        where: { id },
        data: { isActive: true },
      });
    }

    return this.getTenantDetail(id);
  }

  async getInvoices(query: { status?: string; page?: string; limit?: string }) {
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status.toUpperCase();

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async markInvoicePaid(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    });
    if (!invoice) throw new NotFoundException('Faktura topilmadi');
    if (invoice.status === 'PAID') throw new BadRequestException("Allaqachon to'langan");

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });

    // Activate subscription
    if (invoice.subscriptionId) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await this.prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    return updated;
  }

  async getPlans() {
    return this.prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createPlan(body: {
    name: string;
    displayName: string;
    priceMonthly?: number;
    priceYearly?: number;
    maxBranches?: number;
    maxUsers?: number;
    maxCashiers?: number;
    maxRegisters?: number;
    maxProducts?: number;
    monthlyReceipts?: number;
    storageMB?: number;
    features?: Record<string, boolean>;
    sortOrder?: number;
  }) {
    const exists = await this.prisma.plan.findUnique({ where: { name: body.name } });
    if (exists) throw new BadRequestException('Bu nomli tarif allaqachon mavjud');

    return this.prisma.plan.create({ data: body });
  }

  async updatePlan(
    id: string,
    body: {
      displayName?: string;
      priceMonthly?: number;
      priceYearly?: number;
      maxBranches?: number;
      maxUsers?: number;
      maxCashiers?: number;
      maxRegisters?: number;
      maxProducts?: number;
      monthlyReceipts?: number;
      storageMB?: number;
      features?: Record<string, boolean>;
      isActive?: boolean;
    },
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Tarif topilmadi');

    return this.prisma.plan.update({
      where: { id },
      data: body,
    });
  }

  async getDashboard() {
    const [totalTenants, activeTenants, totalUsers, totalSales, openInvoices] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { isActive: true } }),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.sale.count({ where: { status: 'PAID' } }),
        this.prisma.invoice.count({ where: { status: 'OPEN' } }),
      ]);

    const planDistribution = await this.prisma.subscription.groupBy({
      by: ['planId'],
      _count: true,
    });

    return {
      totalTenants,
      activeTenants,
      totalUsers,
      totalSales,
      openInvoices,
      planDistribution,
    };
  }
}
