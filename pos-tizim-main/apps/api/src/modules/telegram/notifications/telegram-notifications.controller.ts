import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TelegramNotificationsService } from './telegram-notifications.service';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@UseGuards(JwtGuard, RolesGuard)
@Controller('telegram/notifications')
export class TelegramNotificationsController {
  constructor(private readonly svc: TelegramNotificationsService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SUPERADMIN)
  @Get('logs')
  getLogs(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.svc.getLogs(user.tenantId!, limit ? parseInt(limit) : 50);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Get('queue')
  getQueue(@CurrentUser() user: AuthUser) {
    return this.svc.getQueue(user.tenantId ?? undefined);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CASHIER, Role.SUPERADMIN)
  @Get('preferences')
  getPreferences(
    @CurrentUser() user: AuthUser,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.svc.getPreferences(user.tenantId!, entityType, entityId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CASHIER, Role.SUPERADMIN)
  @Post('preferences')
  upsertPreference(@CurrentUser() user: AuthUser, @Body() body: {
    entityType: string;
    entityId: string;
    notificationType: string;
    enabled: boolean;
    deliveryMode?: string;
    telegramIdentityId?: string;
  }) {
    return this.svc.upsertPreference({ tenantId: user.tenantId!, ...body });
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.svc.getDeliveryStats(user.tenantId ?? undefined);
  }
}
