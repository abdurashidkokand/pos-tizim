import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@pos/shared';

// Higher number = higher privilege
const ROLE_HIERARCHY: Record<string, number> = {
  [Role.CASHIER]: 1,
  [Role.MANAGER]: 2,
  [Role.ADMIN]: 3,
  [Role.OWNER]: 4,
  [Role.SUPERADMIN]: 5,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Agar role kerak bo'lmasa — ruxsat
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException("Bu amalni bajarish uchun ruxsat yo'q");

    // SUPERADMIN hamma narsaga ruxsat
    if (user.role === Role.SUPERADMIN) return true;

    // Hierarchy: if user's role level >= minimum required role level, allow
    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
    const minRequiredLevel = Math.min(
      ...requiredRoles.map((r) => ROLE_HIERARCHY[r] ?? 99),
    );

    if (userLevel >= minRequiredLevel) return true;

    throw new ForbiddenException("Bu amalni bajarish uchun ruxsat yo'q");
  }
}
