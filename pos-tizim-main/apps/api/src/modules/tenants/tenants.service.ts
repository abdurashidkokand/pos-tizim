import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import type { AuthUser } from '@pos/shared';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async getMyTenant(user: AuthUser) {
    if (!user.tenantId) return null;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: {
        branches: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        subscription: { include: { plan: true } },
        _count: { select: { users: { where: { isActive: true } }, products: { where: { isActive: true } }, branches: { where: { isActive: true } } } },
      },
    });
    if (!tenant) throw new NotFoundException("Do'kon topilmadi");
    return tenant;
  }

  async updateMyTenant(user: AuthUser, body: { name?: string; phone?: string; address?: string }) {
    return this.prisma.tenant.update({
      where: { id: user.tenantId! },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.address !== undefined && { address: body.address }),
      },
    });
  }

  async getPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getMySubscription(user: AuthUser) {
    if (!user.tenantId) return null;
    return this.prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
      include: { plan: true },
    });
  }

  // Branch CRUD within tenant
  async getBranches(tenantId: string | null | undefined) {
    if (!tenantId) return [];
    return this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createBranch(user: AuthUser, body: { name: string; address?: string; phone?: string }) {
    // Check plan limits
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId: user.tenantId! },
      include: { plan: true },
    });
    if (subscription) {
      const branchCount = await this.prisma.branch.count({
        where: { tenantId: user.tenantId!, isActive: true },
      });
      if (branchCount >= subscription.plan.maxBranches) {
        throw new NotFoundException(
          `Tarifingiz bo'yicha maksimal ${subscription.plan.maxBranches} ta filial. Tarifni oshiring.`,
        );
      }
    }

    return this.prisma.branch.create({
      data: {
        tenantId: user.tenantId!,
        name: body.name,
        address: body.address,
        phone: body.phone,
      },
    });
  }

  async updateBranch(user: AuthUser, branchId: string, body: { name?: string; address?: string; phone?: string; isActive?: boolean }) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId: user.tenantId! },
    });
    if (!branch) throw new NotFoundException('Filial topilmadi');

    return this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
  }
}
