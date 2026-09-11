import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import type { AuthUser } from '@pos/shared';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { search?: string; page?: string; limit?: string }, user: AuthUser) {
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
    const skip = (page - 1) * limit;

    const where: any = { tenantId: user.tenantId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          receivables: { where: { status: 'OPEN' } },
          cashbackCards: { where: { isActive: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, user: AuthUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        receivables: {
          include: { payments: true, sale: { select: { receiptNo: true, total: true } } },
          orderBy: { createdAt: 'desc' },
        },
        cashbackCards: { where: { isActive: true } },
        sales: {
          select: { id: true, receiptNo: true, total: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');
    return customer;
  }

  async create(body: { name: string; phone?: string }, user: AuthUser) {
    return this.prisma.customer.create({
      data: {
        tenantId: user.tenantId!,
        name: body.name,
        phone: body.phone,
      },
    });
  }

  async update(id: string, body: { name?: string; phone?: string }, user: AuthUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone }),
      },
    });
  }

  // ── Receivables (Debt) ──
  async getReceivables(query: { status?: string; customerId?: string; page?: string; limit?: string }, user: AuthUser) {
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
    const skip = (page - 1) * limit;

    const where: any = { tenantId: user.tenantId };
    if (query.status) where.status = query.status.toUpperCase();
    if (query.customerId) where.customerId = query.customerId;

    const [data, total] = await Promise.all([
      this.prisma.receivable.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          sale: { select: { receiptNo: true, total: true } },
          payments: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.receivable.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async payReceivable(
    receivableId: string,
    body: { amount: number; type?: string },
    user: AuthUser,
  ) {
    const receivable = await this.prisma.receivable.findFirst({
      where: { id: receivableId, tenantId: user.tenantId },
    });
    if (!receivable) throw new NotFoundException('Qarz topilmadi');
    if (receivable.status === 'CLOSED') throw new BadRequestException('Qarz allaqachon yopilgan');

    const remaining = receivable.amountDue - receivable.amountPaid;
    if (body.amount > remaining) {
      throw new BadRequestException(`Maksimal to'lov miqdori: ${remaining}`);
    }

    const newPaid = receivable.amountPaid + body.amount;
    const isClosed = newPaid >= receivable.amountDue;

    await this.prisma.$transaction([
      this.prisma.receivablePayment.create({
        data: {
          receivableId,
          amount: body.amount,
          type: (body.type?.toUpperCase() as any) || 'CASH',
          userId: user.id,
        },
      }),
      this.prisma.receivable.update({
        where: { id: receivableId },
        data: {
          amountPaid: newPaid,
          status: isClosed ? 'CLOSED' : 'OPEN',
        },
      }),
    ]);

    return this.prisma.receivable.findUnique({
      where: { id: receivableId },
      include: { payments: true, customer: true },
    });
  }

  async getCustomerStatement(customerId: string, user: AuthUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
    });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');

    const receivables = await this.prisma.receivable.findMany({
      where: { customerId, tenantId: user.tenantId },
      include: {
        payments: { orderBy: { createdAt: 'asc' } },
        sale: { select: { receiptNo: true, total: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalDebt = receivables
      .filter((r) => r.status === 'OPEN')
      .reduce((sum, r) => sum + (r.amountDue - r.amountPaid), 0);

    return { customer, receivables, totalDebt };
  }
}
