import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @ApiOperation({ summary: 'Stock moslash — kirim/chiqim (ADMIN/MANAGER)' })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('adjust')
  adjust(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.inventoryService.adjust(body, user);
  }

  @ApiOperation({ summary: "Harakatlar tarixi (stock movements ro'yxati)" })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('movements')
  getMovements(@Query() query: any, @CurrentUser() user: AuthUser) {
    return this.inventoryService.getMovements(query, user.tenantId);
  }
}
