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
import { CustomersService } from './customers.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@ApiTags('Customers & Debt')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @ApiOperation({ summary: "Mijozlar ro'yxati" })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get()
  findAll(@Query() query: any, @CurrentUser() user: AuthUser) {
    return this.customersService.findAll(query, user);
  }

  @ApiOperation({ summary: 'Mijoz detail' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customersService.findOne(id, user);
  }

  @ApiOperation({ summary: "Mijoz qo'shish" })
  @Post()
  create(
    @Body() body: { name: string; phone?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.create(body, user);
  }

  @ApiOperation({ summary: 'Mijoz yangilash' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; phone?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.update(id, body, user);
  }

  @ApiOperation({ summary: "Mijoz bayonnomasi (statement)" })
  @Get(':id/statement')
  getStatement(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customersService.getCustomerStatement(id, user);
  }

  // ── Receivables ──
  @ApiOperation({ summary: "Qarzlar ro'yxati" })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @Get('receivables/all')
  getReceivables(@Query() query: any, @CurrentUser() user: AuthUser) {
    return this.customersService.getReceivables(query, user);
  }

  @ApiOperation({ summary: "Qarzga to'lov qilish" })
  @Post('receivables/:id/pay')
  payReceivable(
    @Param('id') id: string,
    @Body() body: { amount: number; type?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.payReceivable(id, body, user);
  }
}
