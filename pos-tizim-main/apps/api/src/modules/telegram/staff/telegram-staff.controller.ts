import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TelegramStaffService } from './telegram-staff.service';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';

@UseGuards(JwtGuard, RolesGuard)
@Controller('telegram/staff')
export class TelegramStaffController {
  constructor(private readonly svc: TelegramStaffService) {}

  // List all linked staff accounts
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SUPERADMIN)
  @Get('linked')
  getLinkedStaff(@CurrentUser() user: AuthUser) {
    return this.svc.getLinkedStaff(user.tenantId!);
  }

  // Send shift reminder to all linked staff
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  @Post('shift-reminder')
  sendShiftReminder(
    @CurrentUser() user: AuthUser,
    @Body() body: { shiftTime: string; branchName?: string },
  ) {
    return this.svc.sendShiftReminder(user.tenantId!, body.shiftTime, body.branchName);
  }

  // Send stock task alert to all linked staff
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  @Post('stock-task')
  sendStockTask(
    @CurrentUser() user: AuthUser,
    @Body() body: { productName: string; qty: number; message?: string },
  ) {
    return this.svc.sendStockTaskAlert(user.tenantId!, body.productName, body.qty, body.message);
  }

  // Send direct message to a specific linked staff member
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Post(':linkId/notify')
  sendDirect(
    @Param('linkId') linkId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { text: string },
  ) {
    return this.svc.sendDirectToStaff(linkId, body.text, user.tenantId!);
  }

  // Broadcast to all linked staff
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPERADMIN)
  @Post('broadcast')
  broadcast(@CurrentUser() user: AuthUser, @Body() body: { text: string }) {
    return this.svc.notifyAllStaff(user.tenantId!, 'STAFF_BRANCH_NOTICE', body.text);
  }
}
