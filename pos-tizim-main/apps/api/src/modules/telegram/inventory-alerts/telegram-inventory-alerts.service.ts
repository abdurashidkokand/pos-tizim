import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { InventoryAlertType } from '@prisma/client';
import type { AuthUser } from '@pos/shared';

export interface CreateAlertRuleDto {
  alertType: InventoryAlertType;
  productId?: string;
  branchId?: string;
  minQuantity?: number;
  daysWithoutSale?: number;
  velocityWindowDays?: number;
}

export interface CreateSubscriptionDto {
  alertType: InventoryAlertType;
  userId: string;
  telegramIdentityId?: string;
  branchId?: string;
}

@Injectable()
export class TelegramInventoryAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Alert Rules ───────────────────────────────────────────────

  async getRules(tenantId: string) {
    return this.prisma.inventoryAlertRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRule(dto: CreateAlertRuleDto, user: AuthUser) {
    const rule = await this.prisma.inventoryAlertRule.create({
      data: {
        tenantId: user.tenantId!,
        alertType: dto.alertType,
        productId: dto.productId,
        branchId: dto.branchId,
        minQuantity: dto.minQuantity,
        daysWithoutSale: dto.daysWithoutSale,
        velocityWindowDays: dto.velocityWindowDays,
        enabled: true,
      },
    });

    await this.audit.log(user.id, 'CREATE_INVENTORY_ALERT_RULE', 'InventoryAlertRule', rule.id, {
      alertType: dto.alertType,
      productId: dto.productId,
    }, user.tenantId);

    return rule;
  }

  async updateRule(id: string, data: Partial<CreateAlertRuleDto & { enabled: boolean }>, user: AuthUser) {
    const rule = await this.prisma.inventoryAlertRule.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!rule) throw new NotFoundException('Qoida topilmadi');

    const updated = await this.prisma.inventoryAlertRule.update({
      where: { id },
      data,
    });

    await this.audit.log(user.id, 'UPDATE_INVENTORY_ALERT_RULE', 'InventoryAlertRule', id, data as any, user.tenantId);
    return updated;
  }

  async deleteRule(id: string, user: AuthUser) {
    const rule = await this.prisma.inventoryAlertRule.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!rule) throw new NotFoundException('Qoida topilmadi');

    await this.prisma.inventoryAlertRule.delete({ where: { id } });
    await this.audit.log(user.id, 'DELETE_INVENTORY_ALERT_RULE', 'InventoryAlertRule', id, {}, user.tenantId);
    return { ok: true };
  }

  // ── Subscriptions ─────────────────────────────────────────────

  async getSubscriptions(tenantId: string) {
    return this.prisma.inventoryAlertSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertSubscription(dto: CreateSubscriptionDto, user: AuthUser) {
    const existing = await this.prisma.inventoryAlertSubscription.findFirst({
      where: { tenantId: user.tenantId!, userId: dto.userId, alertType: dto.alertType },
    });

    if (existing) {
      return this.prisma.inventoryAlertSubscription.update({
        where: { id: existing.id },
        data: {
          telegramIdentityId: dto.telegramIdentityId,
          branchId: dto.branchId,
          enabled: true,
        },
      });
    }

    return this.prisma.inventoryAlertSubscription.create({
      data: {
        tenantId: user.tenantId!,
        userId: dto.userId,
        telegramIdentityId: dto.telegramIdentityId,
        alertType: dto.alertType,
        branchId: dto.branchId,
        enabled: true,
      },
    });
  }

  async deleteSubscription(id: string, user: AuthUser) {
    await this.prisma.inventoryAlertSubscription.deleteMany({
      where: { id, tenantId: user.tenantId! },
    });
    return { ok: true };
  }
}
