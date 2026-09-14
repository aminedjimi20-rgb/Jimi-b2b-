import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface Period {
  from?: string;
  to?: string;
}

function dateRange(period: Period) {
  const from = period.from ? new Date(period.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = period.to ? new Date(period.to) : new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async sales(period: Period) {
    const { from, to } = dateRange(period);

    const vouchers = await this.prisma.salesVoucher.findMany({
      where: { status: { in: ['CONFIRMED', 'DELIVERED'] }, confirmedAt: { gte: from, lte: to } },
      include: { items: true },
    });

    const revenue = vouchers.reduce((sum, v) => {
      const subtotal = v.items.reduce((s, i) => s + Number(i.lineTotal), 0);
      return sum + subtotal - Number(v.discount) + Number(v.transportCost);
    }, 0);

    const byDay = new Map<string, number>();
    for (const v of vouchers) {
      const day = v.confirmedAt!.toISOString().slice(0, 10);
      const subtotal = v.items.reduce((s, i) => s + Number(i.lineTotal), 0);
      const total = subtotal - Number(v.discount) + Number(v.transportCost);
      byDay.set(day, (byDay.get(day) ?? 0) + total);
    }

    return {
      revenue: Math.round(revenue * 100) / 100,
      voucherCount: vouchers.length,
      averageBasket: vouchers.length ? Math.round((revenue / vouchers.length) * 100) / 100 : 0,
      byDay: Array.from(byDay.entries())
        .map(([date, total]) => ({ date, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async margin(period: Period) {
    const { from, to } = dateRange(period);

    const items = await this.prisma.salesVoucherItem.findMany({
      where: { voucher: { status: { in: ['CONFIRMED', 'DELIVERED'] }, confirmedAt: { gte: from, lte: to } } },
      include: { product: { select: { costPrice: true } } },
    });

    let totalMargin = 0;
    let totalRevenue = 0;
    for (const item of items) {
      // Le coût figé à la confirmation prime toujours — sinon un changement de
      // coût catalogue plus tard fausserait rétroactivement la marge des ventes passées.
      const unitCost = item.costPriceSnapshot ?? item.product.costPrice ?? 0;
      const cost = Number(unitCost) * item.totalUnits;
      const revenue = Number(item.lineTotal);
      totalMargin += revenue - cost;
      totalRevenue += revenue;
    }

    return {
      totalMargin: Math.round(totalMargin * 100) / 100,
      marginPercent: totalRevenue ? Math.round((totalMargin / totalRevenue) * 10000) / 100 : 0,
    };
  }

  async topProducts(period: Period, limit = 10) {
    const { from, to } = dateRange(period);

    const items = await this.prisma.salesVoucherItem.findMany({
      where: { voucher: { status: { in: ['CONFIRMED', 'DELIVERED'] }, confirmedAt: { gte: from, lte: to } } },
      include: { product: { select: { id: true, nameFr: true } } },
    });

    const byProduct = new Map<string, { nameFr: string; unitsSold: number; revenue: number }>();
    for (const item of items) {
      const existing = byProduct.get(item.productId) ?? { nameFr: item.product.nameFr, unitsSold: 0, revenue: 0 };
      existing.unitsSold += item.totalUnits;
      existing.revenue += Number(item.lineTotal);
      byProduct.set(item.productId, existing);
    }

    return Array.from(byProduct.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  async credits() {
    const [customerEntries, supplierEntries] = await Promise.all([
      this.prisma.ledgerEntry.groupBy({ by: ['customerId'], _sum: { amount: true } }),
      this.prisma.supplierLedgerEntry.groupBy({ by: ['manufacturerId'], _sum: { amount: true } }),
    ]);

    const totalCustomerDebt = customerEntries.reduce((sum, e) => sum + Math.max(0, Number(e._sum.amount ?? 0)), 0);
    const totalSupplierDebt = supplierEntries.reduce((sum, e) => sum + Math.max(0, Number(e._sum.amount ?? 0)), 0);

    return {
      totalCustomerDebt: Math.round(totalCustomerDebt * 100) / 100,
      totalSupplierDebt: Math.round(totalSupplierDebt * 100) / 100,
      customersInDebt: customerEntries.filter((e) => Number(e._sum.amount ?? 0) > 0).length,
    };
  }

  async overview() {
    const [products, pendingRequests, pendingReturns, pendingNegotiations, pendingProductRequests] = await Promise.all([
      this.prisma.product.findMany({ where: { deletedAt: null, isActive: true }, select: { currentStock: true, stockMin: true } }),
      this.prisma.registrationRequest.count({ where: { status: 'NEW' } }),
      this.prisma.return.count({ where: { status: 'NEW' } }),
      this.prisma.negotiation.count({ where: { status: 'PENDING' } }),
      this.prisma.productRequest.count({ where: { status: 'NEW' } }),
    ]);

    const lowStockCount = products.filter((p) => p.currentStock <= p.stockMin).length;

    return { lowStockCount, pendingRequests, pendingReturns, pendingNegotiations, pendingProductRequests };
  }
}
