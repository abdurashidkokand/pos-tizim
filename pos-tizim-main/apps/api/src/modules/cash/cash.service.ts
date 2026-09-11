import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  OpenCashSessionSchema,
  CloseCashSessionSchema,
  CashMovementSchema,
} from '@pos/shared';
import type { AuthUser } from '@pos/shared';
import { EVENTS } from '../telegram/events/domain-events';

@Injectable()
export class CashService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  async openSession(body: unknown, user: AuthUser) {
    const data = OpenCashSessionSchema.parse(body);

    // Foydalanuvchining ochiq sessiyasi borligini tekshirish
    const existing = await this.prisma.cashSession.findFirst({
      where: { userId: user.id, status: 'OPEN' },
    });
    if (existing)
      throw new ConflictException(
        "Sizning ochiq sessiyangiz allaqachon mavjud. Avval yoping.",
      );

    const session = await this.prisma.cashSession.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId!,
        branchId: user.branchId,
        openingCash: data.openingCash,
      },
    });

    await this.audit.log(user.id, 'OPEN_SESSION', 'CashSession', session.id, {
      openingCash: data.openingCash,
    }, user.tenantId);

    this.eventEmitter.emit(EVENTS.CASH_SESSION_OPENED, {
      tenantId: user.tenantId!,
      sessionId: session.id,
      userId: user.id,
      openingCash: data.openingCash,
      branchId: user.branchId,
    });

    return session;
  }

  async closeSession(id: string, body: unknown, user: AuthUser) {
    const data = CloseCashSessionSchema.parse(body);
    const session = await this.findSessionOrThrow(id, user.tenantId);

    if (session.status === 'CLOSED')
      throw new BadRequestException("Sessiya allaqachon yopilgan");

    const closed = await this.prisma.cashSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingCash: data.closingCash,
      },
      include: { movements: true },
    });

    await this.audit.log(user.id, 'CLOSE_SESSION', 'CashSession', id, {
      closingCash: data.closingCash,
    }, user.tenantId);

    this.eventEmitter.emit(EVENTS.CASH_SESSION_CLOSED, {
      tenantId: user.tenantId!,
      sessionId: id,
      userId: user.id,
      openingCash: (closed as any).openingCash ?? 0,
      closingCash: data.closingCash,
      branchId: user.branchId,
    });

    return closed;
  }

  async addMovement(id: string, body: unknown, user: AuthUser) {
    const data = CashMovementSchema.parse(body);
    const session = await this.findSessionOrThrow(id, user.tenantId);

    if (session.status === 'CLOSED')
      throw new BadRequestException("Yopilgan sessiyaga harakat qo'shib bo'lmaydi");

    const movement = await this.prisma.cashMovement.create({
      data: {
        cashSessionId: id,
        type: data.type,
        amount: data.amount,
        note: data.note,
      },
    });

    await this.audit.log(user.id, 'CASH_MOVEMENT', 'CashMovement', movement.id, {
      type: data.type,
      amount: data.amount,
    }, user.tenantId);
    return movement;
  }

  async getActive(userId: string) {
    return this.prisma.cashSession.findFirst({
      where: { userId, status: 'OPEN' },
      include: { movements: true },
    });
  }

  async findOne(id: string, tenantId?: string) {
    return this.findSessionOrThrow(id, tenantId);
  }

  async findAll(query: { userId?: string; page?: string | number; limit?: string | number }, tenantId?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Number(query.limit) || 20);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (query.userId) where.userId = query.userId;

    const [data, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where,
        include: {
          user: { select: { id: true, username: true } },
          movements: true,
        },
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
      }),
      this.prisma.cashSession.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private async findSessionOrThrow(id: string, tenantId?: string) {
    const where: Record<string, unknown> = { id };
    if (tenantId) where.tenantId = tenantId;

    const session = await this.prisma.cashSession.findFirst({
      where,
      include: { movements: true },
    });
    if (!session) throw new NotFoundException('Kassa sessiyasi topilmadi');
    return session;
  }
}
