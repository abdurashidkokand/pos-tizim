import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async dailyReport(dateStr?: string, tenantId?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const where: Record<string, unknown> = {
      createdAt: { gte: dayStart, lte: dayEnd },
      status: 'PAID',
    };
    if (tenantId) where.tenantId = tenantId;

    const voidWhere: Record<string, unknown> = {
      createdAt: { gte: dayStart, lte: dayEnd },
      status: 'VOID',
    };
    if (tenantId) voidWhere.tenantId = tenantId;

    const [sales, voidSales] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          items: {
            include: { product: { select: { id: true, name: true, cost: true } } },
          },
          payments: true,
        },
      }),
      this.prisma.sale.count({ where: voidWhere }),
    ]);

    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const totalDiscount = sales.reduce((sum, s) => sum + s.discount, 0);
    const totalItemsSold = sales.reduce(
      (sum, s) => sum + s.items.reduce((is, i) => is + i.qty, 0),
      0,
    );

    // Profit hisoblash (agar cost mavjud bo'lsa)
    let totalCost = 0;
    for (const sale of sales) {
      for (const item of sale.items) {
        if (item.product.cost) {
          totalCost += item.product.cost * item.qty;
        }
      }
    }
    const totalProfit = totalCost > 0 ? totalRevenue - totalCost : null;

    // To'lov usullari bo'yicha
    const paymentBreakdown: Record<string, number> = {};
    for (const sale of sales) {
      for (const payment of sale.payments) {
        paymentBreakdown[payment.type] =
          (paymentBreakdown[payment.type] || 0) + payment.amount;
      }
    }

    return {
      date: dayStart.toISOString().slice(0, 10),
      salesCount: sales.length,
      voidCount: voidSales,
      totalRevenue,
      totalDiscount,
      totalItemsSold,
      totalProfit,
      paymentBreakdown,
    };
  }

  async dailyExcel(dateStr?: string, tenantId?: string): Promise<Buffer> {
    const report = await this.dailyReport(dateStr, tenantId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Kunlik hisobot');

    // Header
    sheet.mergeCells('A1:B1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Kunlik hisobot — ${report.date}`;
    titleCell.font = { bold: true, size: 14 };

    sheet.addRow([]);

    // Stats
    const statsData = [
      ['Sotuvlar soni', report.salesCount],
      ['Bekor qilingan', report.voidCount],
      ['Jami daromad', report.totalRevenue],
      ['Chegirmalar', report.totalDiscount],
      ['Sotilgan mahsulotlar', report.totalItemsSold],
      ['Foyda', report.totalProfit ?? '—'],
    ];

    for (const [label, value] of statsData) {
      const row = sheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    }

    sheet.addRow([]);
    sheet.addRow(['To\'lov usuli', 'Summa']).font = { bold: true };

    for (const [type, amount] of Object.entries(report.paymentBreakdown)) {
      sheet.addRow([type, amount]);
    }

    // Column widths
    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 20;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async dailyPdfHtml(dateStr?: string, tenantId?: string): Promise<string> {
    const report = await this.dailyReport(dateStr, tenantId);
    const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kunlik hisobot — ${report.date}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; }
    h1 { font-size: 18px; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    td, th { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .right { text-align: right; }
    .total { font-weight: bold; font-size: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Kunlik hisobot — ${report.date}</h1>
  <table>
    <tr><th>Ko'rsatkich</th><th class="right">Qiymat</th></tr>
    <tr><td>Sotuvlar soni</td><td class="right">${report.salesCount}</td></tr>
    <tr><td>Bekor qilingan</td><td class="right">${report.voidCount}</td></tr>
    <tr><td class="total">Jami daromad</td><td class="right total">${fmt(report.totalRevenue)} so'm</td></tr>
    <tr><td>Chegirmalar</td><td class="right">${fmt(report.totalDiscount)} so'm</td></tr>
    <tr><td>Sotilgan mahsulotlar</td><td class="right">${report.totalItemsSold} ta</td></tr>
    <tr><td>Foyda</td><td class="right">${report.totalProfit !== null ? fmt(report.totalProfit) + " so'm" : '—'}</td></tr>
  </table>
  ${
    Object.keys(report.paymentBreakdown).length > 0
      ? `
  <table>
    <tr><th>To'lov usuli</th><th class="right">Summa</th></tr>
    ${Object.entries(report.paymentBreakdown)
      .map(
        ([type, amount]) =>
          `<tr><td>${type}</td><td class="right">${fmt(amount as number)} so'm</td></tr>`,
      )
      .join('')}
  </table>`
      : ''
  }
  <p style="text-align:center;color:#999;font-size:12px;margin-top:20px;">
    Marva POS — ${new Date().toISOString().slice(0, 10)}
  </p>
</body>
</html>`;
  }

  async profitReport(query: { from?: string; to?: string; groupBy?: string }, tenantId?: string) {
    const from = query.from ? new Date(query.from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; })();
    const to = query.to ? new Date(query.to + 'T23:59:59.999Z') : new Date();

    const where: Record<string, unknown> = {
      createdAt: { gte: from, lte: to },
      status: { in: ['PAID', 'PARTIAL'] },
    };
    if (tenantId) where.tenantId = tenantId;

    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        id: true,
        total: true,
        grossProfit: true,
        discount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
    const totalProfit = sales.reduce((s, sale) => s + sale.grossProfit, 0);
    const totalDiscount = sales.reduce((s, sale) => s + sale.discount, 0);

    // Group by day
    const dailyMap = new Map<string, { revenue: number; profit: number; count: number }>();
    for (const sale of sales) {
      const day = sale.createdAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(day) || { revenue: 0, profit: 0, count: 0 };
      existing.revenue += sale.total;
      existing.profit += sale.grossProfit;
      existing.count++;
      dailyMap.set(day, existing);
    }

    const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    return {
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      salesCount: sales.length,
      totalRevenue,
      totalProfit,
      totalDiscount,
      profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : 0,
      daily,
    };
  }

  async debtReport(tenantId?: string) {
    const where: Record<string, unknown> = { status: 'OPEN' };
    if (tenantId) where.tenantId = tenantId;

    const receivables = await this.prisma.receivable.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        sale: { select: { id: true, receiptNo: true, total: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalDebt = receivables.reduce((s, r) => s + (r.amountDue - r.amountPaid), 0);

    return {
      totalDebt,
      count: receivables.length,
      receivables,
    };
  }
}
