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
import { TenantsService } from './tenants.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@ApiTags('Tenants')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @ApiOperation({ summary: "Do'kon ma'lumotlari" })
  @Get('me')
  getMyTenant(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getMyTenant(user);
  }

  @ApiOperation({ summary: "Do'kon ma'lumotlarini yangilash (OWNER/ADMIN)" })
  @Roles(Role.ADMIN)
  @Patch('me')
  updateMyTenant(
    @CurrentUser() user: AuthUser,
    @Body() body: { name?: string; phone?: string; address?: string },
  ) {
    return this.tenantsService.updateMyTenant(user, body);
  }

  @ApiOperation({ summary: "Barcha tariflar ro'yxati" })
  @Get('plans')
  getPlans() {
    return this.tenantsService.getPlans();
  }

  @ApiOperation({ summary: "Joriy obuna ma'lumotlari" })
  @Get('subscription')
  getMySubscription(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getMySubscription(user);
  }

  @ApiOperation({ summary: "Filiallar ro'yxati" })
  @Get('branches')
  getBranches(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getBranches(user.tenantId);
  }

  @ApiOperation({ summary: "Filial yaratish (OWNER/ADMIN)" })
  @Roles(Role.ADMIN)
  @Post('branches')
  createBranch(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; address?: string; phone?: string },
  ) {
    return this.tenantsService.createBranch(user, body);
  }

  @ApiOperation({ summary: "Filial yangilash (OWNER/ADMIN)" })
  @Roles(Role.ADMIN)
  @Patch('branches/:id')
  updateBranch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { name?: string; address?: string; phone?: string; isActive?: boolean },
  ) {
    return this.tenantsService.updateBranch(user, id, body);
  }
}
