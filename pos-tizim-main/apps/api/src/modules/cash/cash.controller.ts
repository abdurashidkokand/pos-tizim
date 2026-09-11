import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CashService } from './cash.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@ApiTags('Cash Sessions')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('cash-sessions')
export class CashController {
  constructor(private cashService: CashService) {}

  @ApiOperation({ summary: "Kassa sessiyalari ro'yxati (MANAGER+)" })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get()
  findAll(@Query() query: any, @CurrentUser() user: AuthUser) {
    return this.cashService.findAll(query, user.tenantId);
  }

  @ApiOperation({ summary: 'Hozirgi ochiq sessiya' })
  @Get('active')
  getActive(@CurrentUser() user: AuthUser) {
    return this.cashService.getActive(user.id);
  }

  @ApiOperation({ summary: 'Sessiya detail' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.cashService.findOne(id, user.tenantId);
  }

  @ApiOperation({ summary: 'Kassani ochish' })
  @Post('open')
  open(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.cashService.openSession(body, user);
  }

  @ApiOperation({ summary: 'Kassani yopish' })
  @Post(':id/close')
  close(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cashService.closeSession(id, body, user);
  }

  @ApiOperation({ summary: 'Kassa harakati — kirim (IN) yoki chiqim (OUT) (MANAGER+)' })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post(':id/move')
  move(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cashService.addMovement(id, body, user);
  }
}
