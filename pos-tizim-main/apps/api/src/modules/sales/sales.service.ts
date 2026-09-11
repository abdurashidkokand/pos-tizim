import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSaleSchema, RECEIPT_PREFIX } from '@pos/shared';
import type { AuthUser } from '@pos/shared';
import {
  buildPaginatedResult,
  parsePagination,
} from '../../common/utils/pagination';
import { EVENTS } from '../telegram/events/domain-events';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  private generateReceiptNo(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `${RECEIPT_PREFIX}-${dateStr}-${rand}`;
  }

  private currentMonth(): string {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  }

  async create(body: unknown, user: AuthUser) {
    const data = CreateSaleSchema.parse(body);

    // Idempotency: an offline-queued sale may be replayed after reconnecting —
    // if we already recorded this clientTxnId, return the existing sale as-is.
    if (data.clientTxnId) {
      const existing = await this.prisma.sale.findFirst({
        where: { clientTxnId: data.clientTxnId, tenantId: user.tenantId },
        include: { items: true, payments: true },
      });
      if (existing) return existing;
    }

    // Fetch products with cost for profit calculation
    const productIds = data.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, cost: true, variants: true },
    });
    const productMap = new Map<string, (typeof products)[number]>(products.map((p) => [p.id, p]));

    // Stock tekshirish
    const stocks = await this.prisma.stock.findMany({
      where: { productId: { in: productIds } },
    });

    for (const item of data.items) {
      const variant = item.variantId
        ? productMap.get(item.productId)?.variants.find((candidate) => candidate.id === item.variantId)
        : null;
      if (item.variantId && !variant) {
        throw new NotFoundException('Mahsulot varianti topilmadi');
      }
      if (variant) {
        if (variant.quantity < item.qty) {
          throw new BadRequestException(
            `"${productMap.get(item.productId)?.name}" — omborda yetarli miqdor yo'q (mavjud: ${variant.quantity})`,
          );
        }
        continue;
      }
      const stock = stocks.find((s) => s.productId === item.productId);
      if (!stock || stock.quantity < item.qty) {
        const product = productMap.get(item.productId);
        throw new BadRequestException(
          `"${product?.name ?? item.productId}" — omborda yetarli miqdor yo'q (mavjud: ${stock?.quantity ?? 0})`,
        );
      }
    }

    const subtotal = data.items.reduce((sum, i) => sum + i.price * i.qty, 0);

    // Discount hisoblash
    const discountType = data.discountType ?? 'FIXED';
    const discountValue = data.discountValue ?? data.discount ?? 0;
    let discountAmount: number;

    if (discountType === 'PERCENT') {
      discountAmount = Math.round((subtotal * discountValue) / 100);
    } else {
      discountAmount = discountValue;
    }

    discountAmount = Math.min(discountAmount, subtotal);
    const total = subtotal - discountAmount;
    const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0);

    // Gross profit calculation
    let grossProfit = 0;
    const itemCosts: Map<string, number> = new Map();
    for (const item of data.items) {
      const product = productMap.get(item.productId);
      const unitCost = product?.cost ?? 0;
      itemCosts.set(item.productId, unitCost);
      grossProfit += (item.price - unitCost) * item.qty;
    }
    // Adjust profit for discount
    grossProfit = Math.max(0, grossProfit - discountAmount);

    // Determine sale status: PARTIAL if totalPaid < total (debt), PAID otherwise
    const isPartial = totalPaid < total;
    const saleStatus = isPartial ? 'PARTIAL' : 'PAID';

    // For non-partial sales, payment must cover total
    if (!isPartial && totalPaid < total) {
      throw new BadRequestException(
        `To'lov yetarli emas. Kerak: ${total}, qilingan: ${totalPaid}`,
      );
    }

    // For partial sales, customerId is required
    if (isPartial && !data.customerId) {
      throw new BadRequestException(
        `Qarzga sotuv uchun mijoz (customerId) ko'rsatilishi shart`,
      );
    }

    const receiptNo = this.generateReceiptNo();

    const sale = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Lock stock rows to prevent race conditions
      const lockedStocks = (await tx.$queryRawUnsafe(
        `SELECT id, "productId", quantity FROM "Stock" WHERE "productId" IN (${productIds.map((_, i) => `$${i + 1}`).join(',')}) FOR UPDATE`,
        ...productIds,
      )) as { id: string; productId: string; quantity: number }[];
      const variantIds = data.items.flatMap((item) => item.variantId ? [item.variantId] : []);
      const lockedVariants = variantIds.length
        ? await tx.$queryRawUnsafe(
          `SELECT id, "productId", quantity FROM "ProductVariant" WHERE id IN (${variantIds.map((_, index) => `$${index + 1}`).join(',')}) FOR UPDATE`,
          ...variantIds,
        ) as { id: string; productId: string; quantity: number }[]
        : [];

      for (const item of data.items) {
        const variant = item.variantId
          ? lockedVariants.find((candidate) => candidate.id === item.variantId && candidate.productId === item.productId)
          : null;
        if (item.variantId && (!variant || variant.quantity < item.qty)) {
          throw new BadRequestException(
            `Omborda yetarli miqdor yo'q (mavjud: ${variant?.quantity ?? 0})`,
          );
        }
        if (variant) continue;
        const stock = lockedStocks.find((s) => s.productId === item.productId);
        if (!stock || stock.quantity < item.qty) {
          throw new BadRequestException(
            `Omborda yetarli miqdor yo'q (mavjud: ${stock?.quantity ?? 0})`,
          );
        }
      }

      const created = await tx.sale.create({
        data: {
          receiptNo,
          subtotal,
          discount: discountAmount,
          discountType: discountType as any,
          discountValue,
          total,
          grossProfit,
          status: saleStatus as any,
          userId: user.id,
          tenantId: user.tenantId!,
          branchId: user.branchId,
          customerId: data.customerId ?? null,
          cashSessionId: data.cashSessionId ?? null,
          clientTxnId: data.clientTxnId ?? null,
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId ?? null,
              qty: i.qty,
              price: i.price,
              unitCost: itemCosts.get(i.productId) ?? 0,
            })),
          },
          payments: {
            create: data.payments.map((p) => ({
              type: p.type,
              amount: p.amount,
            })),
          },
        },
        include: { items: true, payments: true },
      });

      // Stock kamaytirish + harakat yozish
      for (const item of data.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { quantity: { decrement: item.qty } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              qtyDelta: -item.qty,
              reason: `Sotuv #${receiptNo}`,
              userId: user.id,
            },
          });
          continue;
        }
        const stock = stocks.find((s) => s.productId === item.productId)!;
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: { decrement: item.qty } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            stockId: stock.id,
            qtyDelta: -item.qty,
            reason: `Sotuv #${receiptNo}`,
            userId: user.id,
          },
        });
      }

      // Create receivable for partial (debt) sales
      if (isPartial && data.customerId) {
        const debtAmount = total - totalPaid;
        await tx.receivable.create({
          data: {
            tenantId: user.tenantId!,
            customerId: data.customerId,
            saleId: created.id,
            amountDue: debtAmount,
            amountPaid: 0,
            status: 'OPEN',
          },
        });
      }

      // Increment monthly receipt counter
      const month = this.currentMonth();
      await tx.usageMonthly.upsert({
        where: { tenantId_month: { tenantId: user.tenantId!, month } },
        create: { tenantId: user.tenantId!, month, receiptsCount: 1 },
        update: { receiptsCount: { increment: 1 } },
      });

      return created;
    });

    await this.audit.log(user.id, 'CREATE_SALE', 'Sale', sale.id, {
      receiptNo,
      total,
      grossProfit,
      status: saleStatus,
      discountType,
      discountValue,
      discountAmount,
    }, user.tenantId);

    // Emit domain event (non-blocking)
    this.eventEmitter.emit(EVENTS.SALE_CREATED, {
      saleId: sale.id,
      tenantId: user.tenantId!,
      branchId: user.branchId,
      userId: user.id,
      customerId: data.customerId ?? null,
      receiptNo,
      total,
      discount: discountAmount,
      grossProfit,
      status: saleStatus,
      itemCount: data.items.length,
      debtAmount: isPartial ? total - totalPaid : 0,
    });

    return sale;
  }

  async findAll(query: {
    from?: string;
    to?: string;
    page?: string | number;
    limit?: string | number;
  }, tenantId?: string) {
    const { page, limit, skip } = parsePagination(query);
    const where: Record<string, unknown> = {};

    if (tenantId) where.tenantId = tenantId;
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.gte = new Date(query.from);
      if (query.to) createdAt.lte = new Date(query.to + 'T23:59:59');
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          user: { select: { id: true, username: true } },
          items: {
            include: { product: { select: { id: true, name: true } } },
          },
          payments: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string, tenantId?: string) {
    const where: Record<string, unknown> = { id };
    if (tenantId) where.tenantId = tenantId;

    const sale = await this.prisma.sale.findFirst({
      where,
      include: {
        user: { select: { id: true, username: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        payments: true,
      },
    });
    if (!sale) throw new NotFoundException('Sotuv topilmadi');
    return sale;
  }

  async voidSale(id: string, user: AuthUser) {
    const sale = await this.findOne(id, user.tenantId);
    if (sale.status === 'VOID')
      throw new BadRequestException('Sotuv allaqachon bekor qilingan');

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.sale.update({ where: { id }, data: { status: 'VOID' } });

      // Stock qaytarish
      for (const item of sale.items) {
        const stock = await tx.stock.findUnique({
          where: { productId: item.productId },
        });
        if (stock) {
          await tx.stock.update({
            where: { id: stock.id },
            data: { quantity: { increment: item.qty } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              stockId: stock.id,
              qtyDelta: item.qty,
              reason: `Bekor qilish #${sale.receiptNo}`,
              userId: user.id,
            },
          });
        }
      }
    });

    await this.audit.log(user.id, 'VOID_SALE', 'Sale', id, {
      receiptNo: sale.receiptNo,
    }, user.tenantId);
    return { success: true };
  }
}
