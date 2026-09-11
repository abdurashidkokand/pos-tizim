import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TelegramCustomerApiService } from './telegram-customer-api.service';
import { TgLinkEntityType } from '@prisma/client';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@UseGuards(JwtGuard, RolesGuard)
@Controller('telegram/customer')
export class TelegramCustomerApiController {
  constructor(private readonly svc: TelegramCustomerApiService) {}

  // Get customer profile + telegram link status
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Get('me')
  getMe(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.svc.getMe(user.tenantId!, entityId ?? user.id);
  }

  // Get loyalty / cashback info for a customer
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Get('loyalty')
  getLoyalty(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.svc.getLoyalty(user.tenantId!, entityId ?? user.id);
  }

  // Get recent sales receipts for a customer
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Get('receipts')
  getReceipts(
    @CurrentUser() user: AuthUser,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getReceipts(user.tenantId!, entityId ?? user.id, limit ? parseInt(limit) : 10);
  }

  // Generate a deep link / token for a customer or owner
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Post('deep-link')
  generateDeepLink(
    @CurrentUser() user: AuthUser,
    @Body() body: { entityId: string; entityType?: string },
  ) {
    const entityType = (body.entityType as TgLinkEntityType) ?? TgLinkEntityType.CUSTOMER;
    return this.svc.generateDeepLink(user.tenantId!, body.entityId, entityType);
  }
}
