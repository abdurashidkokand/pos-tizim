import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TelegramInventoryAlertsService } from './telegram-inventory-alerts.service';
import type {
  CreateAlertRuleDto,
  CreateSubscriptionDto,
} from './telegram-inventory-alerts.service';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@Controller('telegram/inventory-alerts')
@UseGuards(JwtGuard, RolesGuard)
export class TelegramInventoryAlertsController {
  constructor(private readonly svc: TelegramInventoryAlertsService) {}

  // ── Rules ─────────────────────────────────────────────────────

  @Get('rules')
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  getRules(@CurrentUser() user: AuthUser) {
    return this.svc.getRules(user.tenantId!);
  }

  @Post('rules')
  @Roles(Role.OWNER, Role.ADMIN)
  createRule(@Body() body: CreateAlertRuleDto, @CurrentUser() user: AuthUser) {
    return this.svc.createRule(body, user);
  }

  @Patch('rules/:id')
  @Roles(Role.OWNER, Role.ADMIN)
  updateRule(
    @Param('id') id: string,
    @Body() body: Partial<CreateAlertRuleDto & { enabled: boolean }>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.updateRule(id, body, user);
  }

  @Delete('rules/:id')
  @Roles(Role.OWNER, Role.ADMIN)
  deleteRule(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.deleteRule(id, user);
  }

  // ── Subscriptions ─────────────────────────────────────────────

  @Get('subscriptions')
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  getSubscriptions(@CurrentUser() user: AuthUser) {
    return this.svc.getSubscriptions(user.tenantId!);
  }

  @Post('subscriptions')
  @Roles(Role.OWNER, Role.ADMIN)
  upsertSubscription(@Body() body: CreateSubscriptionDto, @CurrentUser() user: AuthUser) {
    return this.svc.upsertSubscription(body, user);
  }

  @Delete('subscriptions/:id')
  @Roles(Role.OWNER, Role.ADMIN)
  deleteSubscription(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.deleteSubscription(id, user);
  }
}
