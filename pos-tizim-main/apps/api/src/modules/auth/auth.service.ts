import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../db/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginSchema } from '@pos/shared';
import type { TokenPayload } from '@pos/shared';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(body: { username: string; password: string }) {
    const dto = LoginSchema.parse(body);

    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user) throw new UnauthorizedException("Noto'g'ri login yoki parol");
    if (!user.isActive) throw new UnauthorizedException('Foydalanuvchi bloklangan');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch)
      throw new UnauthorizedException("Noto'g'ri login yoki parol");

    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role as any,
      tenantId: user.tenantId ?? undefined,
      branchId: user.branchId ?? undefined,
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
      where: { id: user.id },
      data: { refreshToken: hashedRefresh },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
        branchId: user.branchId,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: TokenPayload;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('jwt.secret') + '_refresh',
      });
    } catch {
      throw new ForbiddenException('Refresh token yaroqsiz yoki muddati o\'tgan');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user?.refreshToken)
      throw new ForbiddenException('Refresh token topilmadi');

    const matches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!matches) throw new ForbiddenException('Refresh token mos kelmadi');

    const newPayload: TokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role as any,
      tenantId: user.tenantId ?? undefined,
      branchId: user.branchId ?? undefined,
    };

    const accessToken = this.jwt.sign(newPayload, {
      expiresIn: this.config.get('jwt.accessExpiresIn'),
    });

    return { accessToken };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, fullName: true, role: true,
        tenantId: true, branchId: true, isActive: true, createdAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    return user;
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const passwordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException("Joriy parol noto'g'ri");
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNew },
    });

    return { success: true, message: "Parol muvaffaqiyatli o'zgartirildi" };
  }

  async adminResetPassword(targetUserId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashedNew, refreshToken: null },
    });

    return { success: true };
  }
}
