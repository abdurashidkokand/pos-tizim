import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@pos/shared';
import type { AuthUser } from '@pos/shared';
import type { Response } from 'express';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @ApiOperation({ summary: "Mahsulotlar ro'yxati" })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get()
  findAll(@Query() query: any, @CurrentUser() user: AuthUser) {
    return this.productsService.findAll(query, user);
  }

  @ApiOperation({ summary: "Barcode bo'yicha izlash" })
  @Get('by-barcode/:code')
  findByBarcode(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.productsService.findByBarcode(code, user.tenantId);
  }

  @ApiOperation({ summary: 'Mahsulot detail' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.findOne(id, user.tenantId);
  }

  @ApiOperation({ summary: 'Mahsulot yaratish (ADMIN/MANAGER)' })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  create(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.productsService.create(body, user);
  }

  @ApiOperation({ summary: 'Mahsulot yangilash (ADMIN/MANAGER)' })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.update(id, body, user);
  }

  @ApiOperation({ summary: "Mahsulot o'chirish — soft delete (ADMIN)" })
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.remove(id, user);
  }

  @ApiOperation({ summary: "Mahsulotga barcode qo'shish (ADMIN/MANAGER)" })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post(':id/barcodes')
  addBarcode(
    @Param('id') id: string,
    @Body() body: { code: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.addBarcode(id, body.code, user);
  }

  @ApiOperation({ summary: "Mahsulotdan barcode o'chirish (ADMIN/MANAGER)" })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id/barcodes/:barcodeId')
  removeBarcode(
    @Param('id') id: string,
    @Param('barcodeId') barcodeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.removeBarcode(id, barcodeId, user);
  }

  @ApiOperation({ summary: 'Mahsulotlarni Excel eksport' })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('export/excel')
  async exportExcel(@Res() res: Response, @CurrentUser() user: AuthUser) {
    const buffer = await this.productsService.exportExcel(user);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="mahsulotlar.xlsx"');
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Exceldan mahsulot import (ADMIN/MANAGER)' })
  @ApiConsumes('multipart/form-data')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  @Post('import/excel')
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.importExcel(file.buffer, user);
  }

  @ApiOperation({ summary: 'Ommaviy narx yangilash — foiz bilan (ADMIN)' })
  @Roles(Role.ADMIN)
  @Post('bulk-price')
  bulkPriceUpdate(
    @Body() body: { percentage: number; filter?: { search?: string } },
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.bulkPriceUpdate(body, user);
  }

  @ApiOperation({ summary: 'Mahsulot narx tarixi' })
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get(':id/price-history')
  priceHistory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.priceHistory(id, user.tenantId);
  }
}
