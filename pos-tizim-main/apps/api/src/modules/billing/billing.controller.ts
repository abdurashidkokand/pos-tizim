import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@ApiTags('Billing')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @ApiOperation({ summary: "Joriy billing ma'lumotlari" })
  @Get('me')
  getMyBilling(@CurrentUser() user: AuthUser) {
    return this.billingService.getMyBilling(user);
  }

  @ApiOperation({ summary: 'Tarifga obuna (OWNER+)' })
  @Roles(Role.OWNER)
  @Post('subscribe')
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body() body: { planCode: string },
  ) {
    return this.billingService.subscribe(user, body);
  }

  @ApiOperation({ summary: "Faktura to'lov havolasi" })
  @Post('invoices/:id/pay')
  getInvoicePayLink(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.billingService.getInvoicePayLink(user, id);
  }

  @ApiOperation({ summary: "To'lov webhook (stub)" })
  @Post('webhook')
  webhook(@Body() body: unknown) {
    return this.billingService.handleWebhook(body);
  }
}
