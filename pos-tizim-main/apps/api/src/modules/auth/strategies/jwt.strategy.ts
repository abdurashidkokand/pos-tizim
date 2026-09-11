import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../db/prisma.service';
import type { TokenPayload } from '@pos/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('jwt.secret'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: TokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, tenantId: true, branchId: true, isActive: true },
    });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');
    if (!user.isActive) throw new UnauthorizedException('Foydalanuvchi bloklangan');
    return { id: user.id, username: user.username, role: user.role, tenantId: user.tenantId, branchId: user.branchId };
  }
}
