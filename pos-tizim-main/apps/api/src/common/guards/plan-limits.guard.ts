import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';

@Injectable()
export class PlanLimitsGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SUPERADMIN bypasses all limits
    if (!user || user.role === 'SUPERADMIN' || !user.tenantId) return true;

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
      include: { plan: true },
    });

    if (!subscription) return true;

    // Check if subscription is active
    const now = new Date();
    if (
      subscription.status === 'SUSPENDED' ||
      subscription.status === 'EXPIRED' ||
      subscription.status === 'CANCELED'
    ) {
      throw new HttpException(
        {
          statusCode: 402,
          code: 'BILLING_REQUIRED',
          message: "Obuna muddati tugagan. Iltimos, obunani yangilang.",
        },
        402,
      );
    }

    if (
      subscription.status === 'TRIAL' &&
      subscription.trialEndsAt &&
      subscription.trialEndsAt < now
    ) {
      throw new HttpException(
        {
          statusCode: 402,
          code: 'TRIAL_EXPIRED',
          message: "Sinov muddati tugadi. Iltimos, tarifni tanlang.",
        },
        402,
      );
    }

    // Store plan info on request for downstream use
    request.plan = subscription.plan;
    request.subscription = subscription;

    return true;
  }
}
