import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TelegramTemplatesService, TemplateVariables } from './telegram-templates.service';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';
import { TgAudience, TgParseMode } from '@prisma/client';

@Controller('telegram/templates')
@UseGuards(JwtGuard, RolesGuard)
export class TelegramTemplatesController {
  constructor(private readonly templates: TelegramTemplatesService) {}

  // List all templates (global + current tenant)
  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SUPERADMIN)
  list(@CurrentUser() user: AuthUser, @Query('tenantId') tenantId?: string) {
    return this.templates.findAll(tenantId ?? user.tenantId ?? undefined);
  }

  // Create a template
  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  create(
    @Body() body: {
      code: string;
      audience: TgAudience;
      language?: string;
      titleTemplate?: string;
      bodyTemplate: string;
      parseMode?: TgParseMode;
      inlineKeyboardJson?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.templates.create(
      { ...body, tenantId: user.role === Role.SUPERADMIN ? undefined : (user.tenantId ?? undefined) },
      user,
    );
  }

  // Update a template
  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  update(
    @Param('id') id: string,
    @Body() body: Partial<{
      titleTemplate: string;
      bodyTemplate: string;
      parseMode: TgParseMode;
      inlineKeyboardJson: string;
      isActive: boolean;
    }>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templates.update(id, body, user);
  }

  // Preview rendered template
  @Post(':id/preview')
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  preview(
    @Param('id') id: string,
    @Body() body: { variables?: TemplateVariables },
  ) {
    return this.templates.preview(id, body.variables ?? {});
  }

  // Seed defaults (superadmin only)
  @Post('seed-defaults')
  @Roles(Role.SUPERADMIN)
  seedDefaults() {
    return this.templates.seedDefaults().then(() => ({ ok: true, message: 'Default templates seeded' }));
  }
}
