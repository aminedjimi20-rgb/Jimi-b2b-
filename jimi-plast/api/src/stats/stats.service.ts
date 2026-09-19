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
      this.prisma.ledgerEntry.groupBy({ by: ['customerId'], where: { voidedAt: null }, _sum: { amount: true } }),
      this.prisma.supplierLedgerEntry.groupBy({ by: ['manufacturerId'], where: { voidedAt: null }, _sum: { amount: true } }),
    ]);

    const totalCustomerDebt = customerEntries.reduce((sum, e) => sum + Math.max(0, Number(e._sum.amount ?? 0)), 0);
    const totalSupplierDebt = supplierEntries.reduce((sum, e) => sum + Math.max(0, Number(e._sum.amount ?? 0)), 0);

    return {
      totalCustomerDebt: Math.round(totalCustomerDebt * 100) / 100,
      totalSupplierDebt: Math.round(totalSupplierDebt * 100) / 100,
      customersInDebt: customerEntries.filter((e) => Number(e._sum.amount ?? 0) > 0).length,
    };
  }

  // La "Situation" (§ demandée pour un usage personnel du gérant) répond à
  // 4 questions sur une période donnée : combien j'ai vendu (et gagné dessus
  // après coût), combien j'ai acheté aux fabricants, combien j'ai dépensé en
  // frais généraux (électricité, loyer, livreurs...), et où j'en suis avec
  // les comptes clients/fabricants (soldes actuels, non bornés à la période).
  async situation(period: Period) {
    const { from, to } = dateRange(period);

    const salesVouchers = await this.prisma.salesVoucher.findMany({
      where: { status: { in: ['CONFIRMED', 'DELIVERED'] }, confirmedAt: { gte: from, lte: to } },
      include: { items: { include: { product: { select: { costPrice: true } } } } },
    });
    let salesRevenue = 0;
    let salesCOGS = 0;
    for (const v of salesVouchers) {
      const subtotal = v.items.reduce((s, i) => s + Number(i.lineTotal), 0);
      salesRevenue += subtotal - Number(v.discount) + Number(v.transportCost);
      for (const item of v.items) {
        const unitCost = item.costPriceSnapshot ?? item.product.costPrice ?? 0;
        salesCOGS += Number(unitCost) * item.totalUnits;
      }
    }

    const purchaseVouchers = await this.prisma.purchaseVoucher.findMany({
      where: { status: 'CONFIRMED', confirmedAt: { gte: from, lte: to } },
      include: { items: true },
    });
    const purchaseSpend = purchaseVouchers.reduce((sum, v) => {
      const subtotal = v.items.reduce((s, i) => s + Number(i.lineTotal), 0);
      return sum + subtotal - Number(v.discount) + Number(v.transportCost);
    }, 0);

    const expenses = await this.prisma.expense.findMany({
      where: { deletedAt: null, date: { gte: from, lte: to } },
      include: { category: true },
    });
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const expensesByCategoryMap = new Map<string, number>();
    for (const e of expenses) {
      expensesByCategoryMap.set(e.category.name, (expensesByCategoryMap.get(e.category.name) ?? 0) + Number(e.amount));
    }

    // Coût payé aux livreurs pour les courses rattachées à un bon (vente ou
    // achat) — jamais dans `expenses` (seules les courses sans bon le sont),
    // donc à soustraire séparément pour ne rien compter deux fois.
    const linkedDeliveries = await this.prisma.delivery.findMany({
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: from, lte: to },
        OR: [{ salesVoucherId: { not: null } }, { purchaseVoucherId: { not: null } }],
      },
    });
    const totalDeliveryPayouts = linkedDeliveries.reduce((s, d) => s + Number(d.cost), 0);

    const [customerEntries, supplierEntries] = await Promise.all([
      this.prisma.ledgerEntry.groupBy({ by: ['customerId'], where: { voidedAt: null }, _sum: { amount: true } }),
      this.prisma.supplierLedgerEntry.groupBy({ by: ['manufacturerId'], where: { voidedAt: null }, _sum: { amount: true } }),
    ]);
    const customerDebt = customerEntries.reduce((sum, e) => sum + Math.max(0, Number(e._sum.amount ?? 0)), 0);
    const supplierDebt = supplierEntries.reduce((sum, e) => sum + Math.max(0, Number(e._sum.amount ?? 0)), 0);

    const round = (n: number) => Math.round(n * 100) / 100;
    const grossMargin = salesRevenue - salesCOGS;
    const netProfit = grossMargin - totalExpenses - totalDeliveryPayouts;

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      salesRevenue: round(salesRevenue),
      salesCOGS: round(salesCOGS),
      grossMargin: round(grossMargin),
      purchaseSpend: round(purchaseSpend),
      totalExpenses: round(totalExpenses),
      expensesByCategory: Array.from(expensesByCategoryMap.entries()).map(([name, amount]) => ({ name, amount: round(amount) })),
      totalDeliveryPayouts: round(totalDeliveryPayouts),
      netProfit: round(netProfit),
      customerDebt: round(customerDebt),
      supplierDebt: round(supplierDebt),
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
