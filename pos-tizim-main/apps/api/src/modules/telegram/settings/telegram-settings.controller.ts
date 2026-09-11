import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TelegramSettingsService } from './telegram-settings.service';
import type { SaveBotConfigDto, UpdateTenantSettingsDto } from './telegram-settings.service';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@UseGuards(JwtGuard, RolesGuard)
@Controller('telegram')
export class TelegramSettingsController {
  constructor(private readonly svc: TelegramSettingsService) {}

  // ── SUPERADMIN ───────────────────────────────────────────────

  @Roles(Role.SUPERADMIN)
  @Get('admin/config')
  getGlobalConfig(@CurrentUser() user: AuthUser) {
    return this.svc.getGlobalConfig(user);
  }

  @Roles(Role.SUPERADMIN)
  @Patch('admin/config')
  saveGlobalConfig(@Body() dto: SaveBotConfigDto, @CurrentUser() user: AuthUser) {
    return this.svc.saveGlobalConfig(dto, user);
  }

  @Roles(Role.SUPERADMIN)
  @Post('admin/config/token/rotate')
  rotateToken(@Body('token') token: string, @CurrentUser() user: AuthUser) {
    return this.svc.rotateToken(token, user);
  }

  @Roles(Role.SUPERADMIN)
  @Post('admin/config/webhook/set')
  setWebhook(@CurrentUser() user: AuthUser) {
    return this.svc.setWebhook(user);
  }

  @Roles(Role.SUPERADMIN)
  @Post('admin/config/webhook/delete')
  deleteWebhook(@CurrentUser() user: AuthUser) {
    return this.svc.deleteWebhook(user);
  }

  @Roles(Role.SUPERADMIN)
  @Get('admin/health')
  healthCheck(@CurrentUser() user: AuthUser) {
    return this.svc.healthCheck(user);
  }

  @Roles(Role.SUPERADMIN)
  @Get('admin/tenants')
  getTenantsOverview(@CurrentUser() user: AuthUser) {
    return this.svc.getTenantsOverview(user);
  }

  @Roles(Role.SUPERADMIN)
  @Post('admin/config/test')
  sendTestMessage(@Body('chatId') chatId: string, @CurrentUser() user: AuthUser) {
    return this.svc.sendTestMessage(chatId, user);
  }

  // ── TENANT ───────────────────────────────────────────────────

  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SUPERADMIN)
  @Get('settings')
  getTenantSettings(@CurrentUser() user: AuthUser) {
    return this.svc.getTenantSettings(user.tenantId!);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Patch('settings')
  updateTenantSettings(@Body() dto: UpdateTenantSettingsDto, @CurrentUser() user: AuthUser) {
    return this.svc.updateTenantSettings(user.tenantId!, dto, user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Patch('settings/:tenantId')
  updateTenantSettingsById(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.updateTenantSettings(tenantId, dto, user);
  }
}
