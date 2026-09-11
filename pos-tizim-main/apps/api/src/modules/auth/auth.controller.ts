import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@pos/shared';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Login — accessToken + refreshToken olish' })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli kirish' })
  @ApiResponse({ status: 401, description: 'Login yoki parol xato' })
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Yangi accessToken olish (refreshToken orqali)' })
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Chiqish (refresh tokenni bekor qilish)' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.id);
  }

  @ApiOperation({ summary: 'Hozirgi foydalanuvchi ma\'lumotlari' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @ApiOperation({ summary: "Parolni o'zgartirish" })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(user.id, body.oldPassword, body.newPassword);
  }
}
