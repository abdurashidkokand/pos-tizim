import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdjustStockSchema } from '@pos/shared';
import type { AuthUser } from '@pos/shared';
import {
  buildPaginatedResult,
  parsePagination,
} from '../../common/utils/pagination';
import { EVENTS } from '../telegram/events/domain-events';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  async adjust(body: unknown, user: AuthUser) {
    const data = AdjustStockSchema.parse(body);

    // Ensure product belongs to tenant
    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, tenantId: user.tenantId },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    if (data.variantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: data.variantId, productId: data.productId },
      });
      if (!variant) throw new NotFoundException('Mahsulot varianti topilmadi');

      const newQty = variant.quantity + data.qtyDelta;
      if (newQty < 0) {
        throw new BadRequestException(
          `Omborda yetarli mahsulot yo'q. Hozirgi: ${variant.quantity}, so'ralgan: ${Math.abs(data.qtyDelta)}`,
        );
      }

      const [updatedVariant] = await this.prisma.$transaction([
        this.prisma.productVariant.update({
          where: { id: variant.id },
          data: { quantity: newQty },
        }),
        this.prisma.stockMovement.create({
          data: {
            productId: data.productId,
            variantId: variant.id,
            qtyDelta: data.qtyDelta,
            reason: data.reason,
            userId: user.id,
          },
        }),
      ]);

      await this.audit.log(user.id, 'STOCK_ADJUST', 'ProductVariant', variant.id, {
        productId: data.productId,
        qtyDelta: data.qtyDelta,
        newQty,
        reason: data.reason,
      }, user.tenantId);
      return { ...updatedVariant, quantity: newQty };
    }

    const stock = await this.prisma.stock.findUnique({
      where: { productId: data.productId },
    });
    if (!stock) throw new NotFoundException('Mahsulot ombori topilmadi');

    const newQty = stock.quantity + data.qtyDelta;
    if (newQty < 0)
      throw new BadRequestException(
        `Omborda yetarli mahsulot yo'q. Hozirgi: ${stock.quantity}, so'ralgan: ${Math.abs(data.qtyDelta)}`,
      );

    const [updatedStock] = await this.prisma.$transaction([
      this.prisma.stock.update({
        where: { id: stock.id },
        data: { quantity: newQty },
      }),
      this.prisma.stockMovement.create({
        data: {
          productId: data.productId,
          stockId: stock.id,
          qtyDelta: data.qtyDelta,
          reason: data.reason,
          userId: user.id,
        },
      }),
    ]);

    await this.audit.log(user.id, 'STOCK_ADJUST', 'Stock', stock.id, {
      productId: data.productId,
      qtyDelta: data.qtyDelta,
      newQty,
      reason: data.reason,
    }, user.tenantId);

    // Fetch product name for event, check alert rules
    const alertRule = await this.prisma.inventoryAlertRule.findFirst({
      where: { tenantId: user.tenantId, productId: data.productId, enabled: true },
    });
    const threshold = alertRule?.minQuantity ?? 5;

    if (newQty === 0) {
      this.eventEmitter.emit(EVENTS.STOCK_OUT, {
        tenantId: user.tenantId!,
        productId: data.productId,
        productName: product.name,
        branchId: user.branchId,
      });
    } else if (newQty <= threshold && data.qtyDelta < 0) {
      this.eventEmitter.emit(EVENTS.STOCK_LOW, {
        tenantId: user.tenantId!,
        productId: data.productId,
        productName: product.name,
        currentQty: newQty,
        threshold,
        branchId: user.branchId,
      });
    }

    return { ...updatedStock, quantity: newQty };
  }

  async getMovements(query: {
    productId?: string;
    page?: string | number;
    limit?: string | number;
  }, tenantId?: string) {
    const { page, limit, skip } = parsePagination(query);
    const where: Record<string, unknown> = {};
    if (query.productId) where.productId = query.productId;
    if (tenantId) where.product = { tenantId };

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }
}
