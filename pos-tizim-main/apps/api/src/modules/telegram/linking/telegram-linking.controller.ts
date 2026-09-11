import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TelegramLinkingService } from './telegram-linking.service';
import type { GenerateLinkTokenDto } from './telegram-linking.service';
import { TgLinkEntityType } from '@prisma/client';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@UseGuards(JwtGuard, RolesGuard)
@Controller('telegram')
export class TelegramLinkingController {
  constructor(private readonly svc: TelegramLinkingService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CASHIER, Role.SUPERADMIN)
  @Post('link-token')
  generateLinkToken(@Body() dto: GenerateLinkTokenDto, @CurrentUser() user: AuthUser) {
    return this.svc.generateLinkToken(user.tenantId!, dto, user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Get('linked-accounts')
  getLinkedAccounts(@CurrentUser() user: AuthUser) {
    return this.svc.getLinkedAccounts(user.tenantId!);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Post('linked-accounts/:id/test')
  sendTest(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.sendTestToLinked(id, user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Delete('link/:entityType/:entityId')
  unlink(
    @Param('entityType') entityType: TgLinkEntityType,
    @Param('entityId') entityId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.unlink(user.tenantId!, entityType, entityId, user);
  }
}
