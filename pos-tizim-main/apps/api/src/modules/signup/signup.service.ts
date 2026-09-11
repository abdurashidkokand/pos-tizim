import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../db/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SignupService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signup(body: {
    username: string;
    password: string;
    fullName: string;
    storeName: string;
    phone?: string;
  }) {
    // Validate
    if (!body.username || body.username.length < 3) {
      throw new BadRequestException('Username kamida 3 ta belgi');
    }
    if (!body.password || body.password.length < 8) {
      throw new BadRequestException('Parol kamida 8 ta belgi');
    }
    if (!/[a-zA-Z]/.test(body.password) || !/[0-9]/.test(body.password)) {
      throw new BadRequestException('Parol kamida bitta harf va bitta raqamdan iborat bo\'lishi kerak');
    }
    if (!body.storeName || body.storeName.length < 2) {
      throw new BadRequestException("Do'kon nomi kamida 2 ta belgi");
    }

    // Check username uniqueness
    const exists = await this.prisma.user.findUnique({
      where: { username: body.username },
    });
    if (exists) throw new ConflictException('Bu username allaqachon mavjud');

    // Generate slug
    const baseSlug = body.storeName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
    let slug = baseSlug || 'store';
    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    // Get FREE plan
    const freePlan = await this.prisma.plan.findUnique({ where: { name: 'FREE' } });
    if (!freePlan) throw new BadRequestException('FREE tarif topilmadi');

    const hashedPassword = await bcrypt.hash(body.password, 10);

    // Create everything in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: body.storeName,
          slug,
          phone: body.phone,
        },
      });

      // 2. Create default branch
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Asosiy filial',
        },
      });

      // 3. Create default register
      await tx.register.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          name: 'Kassa #1',
        },
      });

      // 4. Create subscription (FREE with 14-day trial)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: freePlan.id,
          status: 'TRIAL',
          trialEndsAt: trialEnd,
        },
      });

      // 5. Create owner user
      const user = await tx.user.create({
        data: {
          username: body.username,
          password: hashedPassword,
          fullName: body.fullName,
          role: 'OWNER',
          tenantId: tenant.id,
          branchId: branch.id,
        },
      });

      return { tenant, branch, user };
    });

    // Generate tokens
    const payload = {
      sub: result.user.id,
      username: result.user.username,
      role: result.user.role,
      tenantId: result.tenant.id,
      branchId: result.branch.id,
    };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('jwt.accessExpiresIn'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.secret') + '_refresh',
      expiresIn: this.config.get('jwt.refreshExpiresIn'),
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 8);
    await this.prisma.user.update({
      where: { id: result.user.id },
      data: { refreshToken: hashedRefresh },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: result.user.id,
        username: result.user.username,
        fullName: result.user.fullName,
        role: result.user.role,
        tenantId: result.tenant.id,
        branchId: result.branch.id,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
    };
  }

  async getOnboardingStatus(userId: string, tenantId: string) {
    const [branch, register, productsCount, salesCount] = await Promise.all([
      this.prisma.branch.findFirst({ where: { tenantId } }),
      this.prisma.register.findFirst({ where: { tenantId } }),
      this.prisma.product.count({ where: { tenantId, isActive: true } }),
      this.prisma.sale.count({ where: { tenantId } }),
    ]);

    return {
      hasBranch: !!branch,
      hasRegister: !!register,
      hasProducts: productsCount > 0,
      productsCount,
      hasFirstSale: salesCount > 0,
      completed: !!branch && !!register && productsCount > 0 && salesCount > 0,
    };
  }
}
