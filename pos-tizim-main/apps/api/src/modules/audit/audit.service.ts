import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { buildPaginatedResult, parsePagination } from '../../common/utils/pagination';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string | undefined,
    action: string,
    entity: string,
    entityId?: string,
    meta?: Record<string, unknown>,
    tenantId?: string | null,
  ) {
    // Fire-and-forget — audit log xatosi asosiy operatsiyani to'xtatmasin
    this.prisma.auditLog
      .create({
        data: { userId: userId ?? null, action, entity, entityId, meta: meta as any, tenantId: tenantId ?? null },
      })
      .catch(() => {
        // ignore audit errors
      });
  }

  async findAll(query: {
    page?: string | number;
    limit?: string | number;
    from?: string;
    to?: string;
    userId?: string;
  }, tenantId?: string) {
    const { page, limit, skip } = parsePagination(query);
    const where: Record<string, unknown> = {};

    if (tenantId) where.tenantId = tenantId;
    if (query.userId) where.userId = query.userId;
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.gte = new Date(query.from);
      if (query.to) createdAt.lte = new Date(query.to + 'T23:59:59');
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, username: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }
}
