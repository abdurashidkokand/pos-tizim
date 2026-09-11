import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@pos/shared';

@ApiTags('Platform Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
@Controller('platform')
export class PlatformController {
  constructor(private platformService: PlatformService) {}

  @ApiOperation({ summary: 'Platform dashboard' })
  @Get('dashboard')
  dashboard() {
    return this.platformService.getDashboard();
  }

  @ApiOperation({ summary: "Tenantlar ro'yxati" })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('tenants')
  getTenants(@Query() query: any) {
    return this.platformService.getTenants(query);
  }

  @ApiOperation({ summary: 'Tenant detail' })
  @Get('tenants/:id')
  getTenantDetail(@Param('id') id: string) {
    return this.platformService.getTenantDetail(id);
  }

  @ApiOperation({ summary: 'Tenant yangilash (suspend/activate/changePlan/VIP)' })
  @Patch('tenants/:id')
  updateTenant(
    @Param('id') id: string,
    @Body() body: {
      isActive?: boolean;
      extendTrialDays?: number;
      changePlanCode?: string;
      makeVip?: boolean;
    },
  ) {
    return this.platformService.updateTenant(id, body);
  }

  @ApiOperation({ summary: "Fakturalar ro'yxati" })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('invoices')
  getInvoices(@Query() query: any) {
    return this.platformService.getInvoices(query);
  }

  @ApiOperation({ summary: "Fakturani to'langan deb belgilash" })
  @Patch('invoices/:id/mark-paid')
  markInvoicePaid(@Param('id') id: string) {
    return this.platformService.markInvoicePaid(id);
  }

  @ApiOperation({ summary: "Tariflar ro'yxati" })
  @Get('plans')
  getPlans() {
    return this.platformService.getPlans();
  }

  @ApiOperation({ summary: 'Yangi tarif yaratish' })
  @Post('plans')
  createPlan(
    @Body() body: {
      name: string;
      displayName: string;
      priceMonthly?: number;
      priceYearly?: number;
      maxBranches?: number;
      maxUsers?: number;
      maxCashiers?: number;
      maxRegisters?: number;
      maxProducts?: number;
      monthlyReceipts?: number;
      storageMB?: number;
      features?: Record<string, boolean>;
      sortOrder?: number;
    },
  ) {
    return this.platformService.createPlan(body);
  }

  @ApiOperation({ summary: 'Tarif yangilash (narx, limitlar)' })
  @Patch('plans/:id')
  updatePlan(
    @Param('id') id: string,
    @Body() body: {
      displayName?: string;
      priceMonthly?: number;
      priceYearly?: number;
      maxBranches?: number;
      maxUsers?: number;
      maxCashiers?: number;
      maxRegisters?: number;
      maxProducts?: number;
      monthlyReceipts?: number;
      storageMB?: number;
      features?: Record<string, boolean>;
      isActive?: boolean;
    },
  ) {
    return this.platformService.updatePlan(id, body);
  }
}
