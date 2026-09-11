import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CashbackService } from './cashback.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@ApiTags('Cashback')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('cashback')
export class CashbackController {
  constructor(private cashbackService: CashbackService) {}

  @ApiOperation({ summary: "Cashback kartalari ro'yxati" })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('cards')
  getCards(@Query() query: any, @CurrentUser() user: AuthUser) {
    return this.cashbackService.getCards(query, user);
  }

  @ApiOperation({ summary: 'Karta topish (raqam bilan)' })
  @Get('cards/by-number/:cardNumber')
  getCardByNumber(
    @Param('cardNumber') cardNumber: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cashbackService.getCardByNumber(cardNumber, user);
  }

  @ApiOperation({ summary: 'Yangi cashback karta yaratish' })
  @Roles(Role.MANAGER)
  @Post('cards')
  createCard(
    @Body() body: { customerId: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.cashbackService.createCard(body, user);
  }

  @ApiOperation({ summary: 'Cashback ishlatish (redeem)' })
  @Post('redeem')
  redeemCashback(
    @Body() body: { cardId: string; amount: number },
    @CurrentUser() user: AuthUser,
  ) {
    return this.cashbackService.redeemCashback(body, user);
  }

  @ApiOperation({ summary: 'Karta tranzaksiyalari' })
  @Get('cards/:id/transactions')
  getTransactions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cashbackService.getTransactions(id, user);
  }
}
