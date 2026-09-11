import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import * as bcrypt from 'bcryptjs';
import { CreateUserSchema, UpdateUserSchema, Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

// Role hierarchy for permission checks
const ROLE_LEVEL: Record<string, number> = {
  SUPERADMIN: 5,
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  CASHIER: 1,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: AuthUser) {
    return this.prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true, username: true, fullName: true, role: true,
        isActive: true, createdAt: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId?: string) {
    const where: Record<string, unknown> = { id };
    if (tenantId) where.tenantId = tenantId;

    const user = await this.prisma.user.findFirst({
      where,
      select: {
        id: true, username: true, fullName: true, role: true,
        isActive: true, createdAt: true,
        branch: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }

  async create(body: unknown, currentUser: AuthUser) {
    const data = CreateUserSchema.parse(body);

    // Role hierarchy check: can only create users with lower role
    this.checkRolePermission(currentUser.role, data.role);

    // Check plan limits (total users)
    await this.checkUserLimit(currentUser.tenantId!);

    // Check cashier limit separately
    if (data.role === 'CASHIER') {
      await this.checkCashierLimit(currentUser.tenantId!);
    }

    const exists = await this.prisma.user.findUnique({
      where: { username: data.username },
    });
    if (exists) throw new ConflictException('Bu username allaqachon mavjud');

    const hashed = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        username: data.username,
        password: hashed,
        fullName: data.fullName,
        role: data.role,
        tenantId: currentUser.tenantId,
        branchId: data.branchId || currentUser.branchId,
      },
      select: {
        id: true, username: true, fullName: true, role: true,
        isActive: true, createdAt: true,
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, body: unknown, currentUser: AuthUser) {
    const existing = await this.findOne(id, currentUser.tenantId);
    const data = UpdateUserSchema.parse(body);

    // Cannot edit user with equal or higher role (except yourself)
    if (id !== currentUser.id) {
      const targetLevel = ROLE_LEVEL[existing.role] ?? 0;
      const myLevel = ROLE_LEVEL[currentUser.role] ?? 0;
      if (targetLevel >= myLevel) {
        throw new ForbiddenException('Bu foydalanuvchini tahrirlash uchun yetarli huquq yo\'q');
      }
    }

    // If changing role, check hierarchy
    if (data.role) {
      this.checkRolePermission(currentUser.role, data.role);
    }

    const updateData: Record<string, unknown> = {};
    if (data.role) updateData.role = data.role;
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, username: true, fullName: true, role: true,
        isActive: true, createdAt: true,
        branch: { select: { id: true, name: true } },
      },
    });
  }

  private checkRolePermission(creatorRole: string, targetRole: string) {
    const myLevel = ROLE_LEVEL[creatorRole] ?? 0;
    const targetLevel = ROLE_LEVEL[targetRole] ?? 0;

    if (targetLevel >= myLevel) {
      throw new ForbiddenException(
        `Siz "${targetRole}" rolini bera olmaysiz. Faqat o'zingizdan past rollarni berish mumkin.`,
      );
    }
  }

  private async checkUserLimit(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!subscription) return;

    const currentCount = await this.prisma.user.count({
      where: { tenantId, isActive: true },
    });

    if (currentCount >= subscription.plan.maxUsers) {
      throw new ForbiddenException(
        `Tarifingiz bo'yicha maksimal ${subscription.plan.maxUsers} ta foydalanuvchi. Tarifni oshiring.`,
      );
    }
  }

  private async checkCashierLimit(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!subscription) return;

    const cashierCount = await this.prisma.user.count({
      where: { tenantId, isActive: true, role: 'CASHIER' },
    });

    if (cashierCount >= subscription.plan.maxCashiers) {
      throw new ForbiddenException(
        `Tarifingiz bo'yicha maksimal ${subscription.plan.maxCashiers} ta kassir. Tarifni oshiring.`,
      );
    }
  }
}
