import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';
import type { Response } from 'express';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @ApiOperation({ summary: "Kunlik hisobot (ADMIN/MANAGER)" })
  @ApiQuery({ name: 'date', required: false, example: '2026-03-07' })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('daily')
  daily(@Query('date') date: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.dailyReport(date, user.tenantId);
  }

  @ApiOperation({ summary: "Kunlik hisobot — Excel eksport" })
  @ApiQuery({ name: 'date', required: false })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('daily.xlsx')
  async dailyExcel(@Query('date') date: string, @Res() res: Response, @CurrentUser() user: AuthUser) {
    const buffer = await this.reportsService.dailyExcel(date, user.tenantId);
    const filename = `hisobot-${date || new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @ApiOperation({ summary: "Kunlik hisobot — PDF (print HTML)" })
  @ApiQuery({ name: 'date', required: false })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('daily.pdf')
  async dailyPdf(@Query('date') date: string, @Res() res: Response, @CurrentUser() user: AuthUser) {
    const html = await this.reportsService.dailyPdfHtml(date, user.tenantId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @ApiOperation({ summary: "Foyda hisoboti (ADMIN+)" })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-12-31' })
  @Roles(Role.ADMIN)
  @Get('profit')
  profit(@Query() query: { from?: string; to?: string }, @CurrentUser() user: AuthUser) {
    return this.reportsService.profitReport(query, user.tenantId);
  }

  @ApiOperation({ summary: "Qarz hisoboti (ADMIN+)" })
  @Roles(Role.ADMIN)
  @Get('debt')
  debt(@CurrentUser() user: AuthUser) {
    return this.reportsService.debtReport(user.tenantId);
  }
}
