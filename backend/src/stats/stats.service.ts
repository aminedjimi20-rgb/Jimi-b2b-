import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatsQueryDto } from './dto/stats-query.dto';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin-only aggregate dashboard. Every number here (chiffre d'affaires,
   * bénéfice réel, marge) depends on prixAchat — this whole service must
   * never be reachable from a CLIENT-scoped route.
   */
  async dashboard(query: StatsQueryDto) {
    const from = query.from ? new Date(query.from) : new Date(0);
    const to = query.to ? new Date(query.to) : new Date();

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { not: 'ANNULEE' } },
      include: {
        items: { include: { product: { select: { id: true, nom: true, prixAchat: true } } } },
        client: { select: { id: true, raisonSociale: true } },
      },
    });

    let chiffreAffaires = new Prisma.Decimal(0);
    let benefice = new Prisma.Decimal(0);
    const parProduit = new Map<string, { nom: string; quantite: number; ca: Prisma.Decimal }>();
    const parClient = new Map<string, { nom: string; ca: Prisma.Decimal }>();

    for (const order of orders) {
      chiffreAffaires = chiffreAffaires.plus(order.total);

      const clientEntry = parClient.get(order.clientId) ?? { nom: order.client.raisonSociale, ca: new Prisma.Decimal(0) };
      clientEntry.ca = clientEntry.ca.plus(order.total);
      parClient.set(order.clientId, clientEntry);

      for (const item of order.items) {
        const ligneCA = item.prixUnitaire.mul(item.quantite);
        const ligneBenefice = item.prixUnitaire.minus(item.product.prixAchat).mul(item.quantite);
        benefice = benefice.plus(ligneBenefice);

        const produitEntry = parProduit.get(item.productId) ?? {
          nom: item.product.nom,
          quantite: 0,
          ca: new Prisma.Decimal(0),
        };
        produitEntry.quantite += item.quantite;
        produitEntry.ca = produitEntry.ca.plus(ligneCA);
        parProduit.set(item.productId, produitEntry);
      }
    }

    const margePourcentage = chiffreAffaires.isZero() ? new Prisma.Decimal(0) : benefice.div(chiffreAffaires).mul(100);

    const produits = await this.prisma.product.findMany({ where: { actif: true } });
    const stockFaible = produits
      .filter((p) => p.stockReel <= p.stockMinimum)
      .map((p) => ({ id: p.id, nom: p.nom, code: p.code, stockReel: p.stockReel, stockMinimum: p.stockMinimum }));

    return {
      periode: { from, to },
      chiffreAffaires,
      benefice,
      margePourcentage,
      nombreCommandes: orders.length,
      topProduits: [...parProduit.entries()]
        .map(([productId, v]) => ({ productId, ...v }))
        .sort((a, b) => b.quantite - a.quantite)
        .slice(0, 10),
      topClients: [...parClient.entries()]
        .map(([clientId, v]) => ({ clientId, ...v }))
        .sort((a, b) => (a.ca.lessThan(b.ca) ? 1 : -1))
        .slice(0, 10),
      stockFaible,
    };
  }
}
