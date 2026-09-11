import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductSchema, UpdateProductSchema } from '@pos/shared';
import type { AuthUser } from '@pos/shared';
import {
  buildPaginatedResult,
  parsePagination,
} from '../../common/utils/pagination';
import { generateEan13 } from '../../common/utils/barcode';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Generates a fresh EAN-13 barcode guaranteed not to collide with an existing one
  private async generateUniqueBarcode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateEan13();
      const exists = await this.prisma.barcode.findFirst({ where: { code } });
      if (!exists) return code;
    }
    throw new Error('Unique barcode generatsiya qilib bo\'lmadi');
  }

  async findAll(query: {
    search?: string;
    page?: string | number;
    limit?: string | number;
  }, user: AuthUser) {
    const { page, limit, skip } = parsePagination(query);
    const where: Record<string, unknown> = { isActive: true, tenantId: user.tenantId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcodes: { some: { code: { contains: query.search, mode: 'insensitive' } } } },
        { variants: { some: { barcode: { code: { contains: query.search, mode: 'insensitive' } } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { barcodes: true, stock: true, variants: { include: { barcode: true } }, images: { orderBy: { sortOrder: 'asc' } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string, tenantId?: string) {
    const where: Record<string, unknown> = { id };
    if (tenantId) where.tenantId = tenantId;

    const product = await this.prisma.product.findFirst({
      where,
      include: { barcodes: true, stock: true, variants: { include: { barcode: true } }, images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!product || !product.isActive)
      throw new NotFoundException('Mahsulot topilmadi');
    return product;
  }

  async findByBarcode(code: string, tenantId?: string) {
    const barcode = await this.prisma.barcode.findFirst({
      where: {
        code,
        product: tenantId ? { tenantId, isActive: true } : { isActive: true },
      },
      include: {
        product: { include: { stock: true, barcodes: true, variants: { include: { barcode: true } }, images: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!barcode || !barcode.product.isActive)
      throw new NotFoundException('Barcode topilmadi');
    return { ...barcode.product, matchedVariantId: barcode.variantId ?? undefined };
  }

  async create(body: unknown, user: AuthUser) {
    const data = CreateProductSchema.parse(body);
    const { barcodes, variants, ...productData } = data;

    // Check plan product limit
    await this.checkProductLimit(user.tenantId!);

    const requestedVariants = variants?.length
      ? variants
      : [{ quantity: 0, barcode: barcodes?.[0] }];
    const barcodeCodes = requestedVariants.map((variant) => variant.barcode).filter(Boolean) as string[];
    if (new Set(barcodeCodes).size !== barcodeCodes.length)
      throw new ConflictException('Variant barcodelari takrorlanmasligi kerak');
    for (const code of barcodeCodes) {
      const existing = await this.prisma.barcode.findUnique({ where: { code } });
      if (existing) throw new ConflictException(`"${code}" barcode allaqachon mavjud`);
    }

    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        price: data.price,
        cost: data.cost,
        tenantId: user.tenantId!,
        branchId: user.branchId,
        stock: { create: { quantity: 0 } },
        variants: {
          create: await Promise.all(requestedVariants.map(async (variant) => ({
            size: variant.size || null,
            color: variant.color || null,
            sku: variant.sku || null,
            price: variant.price ?? null,
            cost: variant.cost ?? null,
            quantity: variant.quantity,
            barcode: { create: { code: variant.barcode || await this.generateUniqueBarcode() } },
          }))),
        },
      },
      include: { barcodes: true, stock: true, variants: { include: { barcode: true } }, images: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.log(user.id, 'CREATE', 'Product', product.id, {
      name: product.name,
    }, user.tenantId);
    return product;
  }

  async update(id: string, body: unknown, user: AuthUser) {
    const existing = await this.findOne(id, user.tenantId);
    const data = UpdateProductSchema.parse(body);

    // Track price change
    if (data.price && data.price !== existing.price) {
      await this.prisma.priceHistory.create({
        data: {
          productId: id,
          oldPrice: existing.price,
          newPrice: data.price,
          changedBy: user.id,
        },
      });
    }

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: { barcodes: true, stock: true, variants: { include: { barcode: true } }, images: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.log(user.id, 'UPDATE', 'Product', product.id, data, user.tenantId);
    return product;
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user.tenantId);
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log(user.id, 'DELETE', 'Product', id, {}, user.tenantId);
    return { success: true };
  }

  async addBarcode(productId: string, code: string, user: AuthUser) {
    await this.findOne(productId, user.tenantId);
    const existing = await this.prisma.barcode.findFirst({
      where: { code, product: { tenantId: user.tenantId } },
    });
    if (existing)
      throw new ConflictException(`"${code}" barcode allaqachon mavjud`);

    const barcode = await this.prisma.barcode.create({
      data: { code, productId },
    });
    await this.audit.log(user.id, 'CREATE', 'Barcode', barcode.id, {
      code,
      productId,
    }, user.tenantId);
    return barcode;
  }

  async removeBarcode(productId: string, barcodeId: string, user: AuthUser) {
    await this.findOne(productId, user.tenantId);
    const barcode = await this.prisma.barcode.findFirst({
      where: { id: barcodeId, productId },
    });
    if (!barcode) throw new NotFoundException('Barcode topilmadi');

    await this.prisma.barcode.delete({ where: { id: barcodeId } });
    await this.audit.log(user.id, 'DELETE', 'Barcode', barcodeId, {
      code: barcode.code,
    }, user.tenantId);
    return { success: true };
  }

  async exportExcel(user: AuthUser): Promise<Buffer> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, tenantId: user.tenantId },
      include: { barcodes: true, stock: true },
      orderBy: { name: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mahsulotlar');

    sheet.columns = [
      { header: 'Nomi', key: 'name', width: 30 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Narx', key: 'price', width: 15 },
      { header: 'Tan narx', key: 'cost', width: 15 },
      { header: 'Ombor', key: 'stock', width: 10 },
      { header: 'Barcode', key: 'barcode', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const p of products) {
      sheet.addRow({
        name: p.name,
        sku: p.sku ?? '',
        price: p.price,
        cost: p.cost ?? '',
        stock: p.stock?.quantity ?? 0,
        barcode: p.barcodes.map((b) => b.code).join(', '),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importExcel(fileBuffer: Buffer, user: AuthUser) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel fayl bo\'sh');

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      const name = String(row.getCell(1).value ?? '').trim();
      const sku = String(row.getCell(2).value ?? '').trim() || undefined;
      const price = Number(row.getCell(3).value) || 0;
      const cost = Number(row.getCell(4).value) || undefined;
      const barcodeStr = String(row.getCell(6).value ?? '').trim();

      if (!name) continue;
      if (price <= 0) {
        results.errors.push(`${rowNum}-qator: "${name}" — narx noto'g'ri`);
        results.skipped++;
        continue;
      }

      // Check duplicate by SKU within tenant
      if (sku) {
        const existing = await this.prisma.product.findFirst({
          where: { sku, tenantId: user.tenantId, isActive: true },
        });
        if (existing) {
          results.errors.push(`${rowNum}-qator: "${name}" — SKU "${sku}" allaqachon mavjud`);
          results.skipped++;
          continue;
        }
      }

      // Parse barcodes (comma-separated)
      const barcodes = barcodeStr
        ? barcodeStr.split(',').map((b) => b.trim()).filter(Boolean)
        : [];

      // Check duplicate barcodes within tenant
      let barcodeDuplicate = false;
      for (const code of barcodes) {
        const existing = await this.prisma.barcode.findFirst({
          where: { code, product: { tenantId: user.tenantId } },
        });
        if (existing) {
          results.errors.push(`${rowNum}-qator: "${name}" — barcode "${code}" allaqachon mavjud`);
          barcodeDuplicate = true;
          break;
        }
      }
      if (barcodeDuplicate) {
        results.skipped++;
        continue;
      }

      // No barcode column filled in — auto-generate one so the row is still scannable
      const finalBarcodes = barcodes.length > 0 ? barcodes : [await this.generateUniqueBarcode()];

      await this.prisma.product.create({
        data: {
          name,
          sku,
          price,
          cost,
          tenantId: user.tenantId!,
          branchId: user.branchId,
          stock: { create: { quantity: 0 } },
          barcodes: { create: finalBarcodes.map((code) => ({ code })) },
        },
      });
      results.created++;
    }

    await this.audit.log(user.id, 'IMPORT', 'Product', 'bulk', {
      created: results.created,
      skipped: results.skipped,
    }, user.tenantId);

    return results;
  }

  async bulkPriceUpdate(
    body: { percentage: number; filter?: { search?: string } },
    user: AuthUser,
  ) {
    const { percentage, filter } = body;
    if (percentage === 0) throw new BadRequestException('Foiz 0 bo\'lmasligi kerak');
    if (Math.abs(percentage) > 100 && percentage < 0)
      throw new BadRequestException('100% dan ko\'p tushirish mumkin emas');

    const where: Record<string, unknown> = { isActive: true, tenantId: user.tenantId };
    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { sku: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const products = await this.prisma.product.findMany({ where });
    let updated = 0;

    for (const product of products) {
      const newPrice = Math.max(1, Math.round(product.price * (1 + percentage / 100)));
      if (newPrice === product.price) continue;

      await this.prisma.$transaction([
        this.prisma.priceHistory.create({
          data: {
            productId: product.id,
            oldPrice: product.price,
            newPrice,
            changedBy: user.id,
          },
        }),
        this.prisma.product.update({
          where: { id: product.id },
          data: { price: newPrice },
        }),
      ]);
      updated++;
    }

    await this.audit.log(user.id, 'BULK_PRICE_UPDATE', 'Product', 'bulk', {
      percentage,
      filter,
      updated,
    }, user.tenantId);

    return { updated, total: products.length };
  }

  async priceHistory(productId: string, tenantId?: string) {
    // Ensure product belongs to tenant
    if (tenantId) await this.findOne(productId, tenantId);
    return this.prisma.priceHistory.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async checkProductLimit(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!subscription) return;

    const currentCount = await this.prisma.product.count({
      where: { tenantId, isActive: true },
    });

    if (currentCount >= subscription.plan.maxProducts) {
      throw new ForbiddenException(
        `Tarifingiz bo'yicha maksimal ${subscription.plan.maxProducts} ta mahsulot. Tarifni oshiring.`,
      );
    }
  }
}
