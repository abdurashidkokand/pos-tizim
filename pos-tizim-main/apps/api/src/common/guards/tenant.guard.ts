import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@pos/shared';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Foydalanuvchi topilmadi');

    // SUPERADMIN doesn't need tenantId
    if (user.role === Role.SUPERADMIN) return true;

    if (!user.tenantId) {
      throw new ForbiddenException("Do'kon ma'lumotlari topilmadi");
    }

    return true;
  }
}
