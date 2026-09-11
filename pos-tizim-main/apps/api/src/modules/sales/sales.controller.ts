import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@ApiTags('Sales')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private salesService: SalesService) {}

  @ApiOperation({ summary: 'Yangi sotuv yaratish' })
  @Post()
  create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.salesService.create(body, user);
  }

  @ApiOperation({ summary: "Sotuvlar ro'yxati" })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-12-31' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get()
  findAll(@Query() query: any, @CurrentUser() user: AuthUser) {
    return this.salesService.findAll(query, user.tenantId);
  }

  @ApiOperation({ summary: 'Sotuv detail' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.findOne(id, user.tenantId);
  }

  @ApiOperation({ summary: 'Sotuvni bekor qilish — void (ADMIN/MANAGER)' })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post(':id/void')
  voidSale(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.voidSale(id, user);
  }
}
