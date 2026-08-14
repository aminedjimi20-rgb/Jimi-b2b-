import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async productsWorkbook(): Promise<ExcelJS.Buffer> {
    const products = await this.prisma.product.findMany({ include: { category: true } });
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Produits');
    sheet.columns = [
      { header: 'Code', key: 'code', width: 15 },
      { header: 'Nom', key: 'nom', width: 30 },
      { header: 'Catégorie', key: 'categorie', width: 20 },
      { header: 'Prix Achat', key: 'prixAchat', width: 15 },
      { header: 'Prix Vente', key: 'prixVente', width: 15 },
      { header: 'Marge', key: 'marge', width: 15 },
      { header: 'Stock réel', key: 'stockReel', width: 12 },
      { header: 'Stock min', key: 'stockMinimum', width: 12 },
      { header: 'Actif', key: 'actif', width: 10 },
    ];
    for (const p of products) {
      sheet.addRow({
        code: p.code,
        nom: p.nom,
        categorie: p.category.nom,
        prixAchat: p.prixAchat.toNumber(),
        prixVente: p.prixVente.toNumber(),
        marge: p.prixVente.minus(p.prixAchat).toNumber(),
        stockReel: p.stockReel,
        stockMinimum: p.stockMinimum,
        actif: p.actif ? 'Oui' : 'Non',
      });
    }
    return wb.xlsx.writeBuffer();
  }

  async ordersWorkbook(): Promise<ExcelJS.Buffer> {
    const orders = await this.prisma.order.findMany({
      include: { client: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Commandes');
    sheet.columns = [
      { header: 'Référence', key: 'reference', width: 18 },
      { header: 'Client', key: 'client', width: 25 },
      { header: 'Statut', key: 'status', width: 15 },
      { header: 'Paiement', key: 'paymentMethod', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Nb articles', key: 'nbArticles', width: 12 },
      { header: 'Date', key: 'date', width: 20 },
    ];
    for (const o of orders) {
      sheet.addRow({
        reference: o.reference,
        client: o.client.raisonSociale,
        status: o.status,
        paymentMethod: o.paymentMethod,
        total: o.total.toNumber(),
        nbArticles: o.items.length,
        date: o.createdAt.toISOString(),
      });
    }
    return wb.xlsx.writeBuffer();
  }

  async clientsWorkbook(): Promise<ExcelJS.Buffer> {
    const clients = await this.prisma.client.findMany({ include: { user: true } });
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Clients');
    sheet.columns = [
      { header: 'Raison sociale', key: 'raisonSociale', width: 30 },
      { header: 'Téléphone', key: 'telephone', width: 18 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Ville', key: 'ville', width: 18 },
      { header: 'Limite crédit', key: 'limiteCredit', width: 15 },
      { header: 'Solde crédit', key: 'soldeCredit', width: 15 },
      { header: 'Statut', key: 'status', width: 12 },
    ];
    for (const c of clients) {
      sheet.addRow({
        raisonSociale: c.raisonSociale,
        telephone: c.telephone,
        email: c.user.email,
        ville: c.ville,
        limiteCredit: c.limiteCredit.toNumber(),
        soldeCredit: c.soldeCredit.toNumber(),
        status: c.user.status,
      });
    }
    return wb.xlsx.writeBuffer();
  }
}
