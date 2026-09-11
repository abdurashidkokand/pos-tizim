import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
  ) {}

  @ApiOperation({ summary: "Foydalanuvchilar ro'yxati (ADMIN+)" })
  @Roles(Role.ADMIN)
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user);
  }

  @ApiOperation({ summary: 'Foydalanuvchi yaratish (ADMIN+)' })
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.usersService.create(body, user);
  }

  @ApiOperation({ summary: 'Foydalanuvchini yangilash — role/parol (ADMIN+)' })
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.usersService.update(id, body, user);
  }

  @ApiOperation({ summary: "Foydalanuvchi parolini admin tomonidan o'zgartirish (ADMIN+)" })
  @Roles(Role.ADMIN)
  @Patch(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.authService.adminResetPassword(id, body.newPassword);
  }
}
