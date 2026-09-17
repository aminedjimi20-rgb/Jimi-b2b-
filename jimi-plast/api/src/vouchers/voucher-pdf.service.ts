import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface VoucherForPdf {
  number: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  customer: { businessName: string | null; user: { fullName: string; phone: string | null } };
  seller: { fullName: string };
  discount: unknown;
  transportCost: unknown;
  paidAmount: unknown;
  previousCredit: unknown;
  notes: string | null;
  items: {
    product: { nameFr: string };
    packagingUnit: { label: string };
    quantityPackages: number;
    unitsPerPackageSnapshot: number;
    totalUnits: number;
    actualTotalUnits: number | null;
    unitPrice: unknown;
    lineTotal: unknown;
    isLoaded: boolean;
  }[];
}

const ACCENT = '#d9641f';
const INK = '#201d1a';
const MUTED = '#78705f';
const LINE = '#e1dbca';

const PAGE_BOTTOM = 760;
const TABLE_LEFT = 40;
const TABLE_RIGHT = 555;

// Colonnes dans l'ordre du bon papier de référence : case à cocher, nombre
// de colis, colissage (pièces/colis), quantité réelle, désignation, prix
// unitaire, total HT.
const COLS = {
  check: { x: 40, w: 16 },
  colis: { x: 58, w: 35 },
  colissage: { x: 96, w: 48 },
  qte: { x: 148, w: 45 },
  designation: { x: 197, w: 188 },
  pu: { x: 390, w: 60 },
  pht: { x: 455, w: 100 },
};

/**
 * Génère le bon en PDF côté serveur pour un rendu identique quel que soit
 * l'appareil (§12 du cahier des charges) — jamais recalculé côté client.
 */
@Injectable()
export class VoucherPdfService {
  generate(voucher: VoucherForPdf): PDFKit.PDFDocument {
    const d = new PDFDocument({ size: 'A4', margin: 40 });

    const num = (v: unknown) => Number(v ?? 0);
    const subtotal = voucher.items.reduce((s, i) => s + num(i.lineTotal), 0);
    const total = subtotal - num(voucher.discount) + num(voucher.transportCost);
    const newCredit = num(voucher.previousCredit) + total - num(voucher.paidAmount);
    const totalColis = voucher.items.reduce((s, i) => s + i.quantityPackages, 0);
    const totalQte = voucher.items.reduce((s, i) => s + (i.actualTotalUnits ?? i.totalUnits), 0);

    const drawHeader = () => {
      d.fillColor(ACCENT).fontSize(20).font('Helvetica-Bold').text('JIMI PLAST', 40, 40);
      d.fillColor(MUTED).fontSize(9).font('Helvetica').text('Distribution — plastique & articles ménagers', 40, 64);

      d.fillColor(INK).fontSize(14).font('Helvetica-Bold').text(`BON DE VENTE ${voucher.number ?? '(brouillon)'}`, 300, 40, {
        width: 255,
        align: 'right',
      });
      d.fillColor(MUTED)
        .fontSize(9)
        .font('Helvetica')
        .text(`Date : ${voucher.createdAt.toLocaleDateString('fr-FR')}`, 300, 60, { width: 255, align: 'right' })
        .text(`Vendeur : ${voucher.seller.fullName}`, 300, 74, { width: 255, align: 'right' });

      d.moveTo(40, 100).lineTo(555, 100).strokeColor(LINE).stroke();

      d.fillColor(INK).fontSize(11).font('Helvetica-Bold').text('Pour', 40, 112);
      d.fontSize(10)
        .font('Helvetica')
        .text(voucher.customer.businessName ?? voucher.customer.user.fullName, 40, 128)
        .text(voucher.customer.user.fullName, 40, 142)
        .text(voucher.customer.user.phone ?? '', 40, 156);
    };

    const drawTableHead = (y: number) => {
      d.fontSize(8).font('Helvetica-Bold').fillColor(MUTED);
      d.text('N.colis', COLS.colis.x, y, { width: COLS.colis.w, align: 'right' });
      d.text('Colissage', COLS.colissage.x, y, { width: COLS.colissage.w, align: 'right' });
      d.text('Qté', COLS.qte.x, y, { width: COLS.qte.w, align: 'right' });
      d.text('Désignation', COLS.designation.x, y, { width: COLS.designation.w });
      d.text('P.U', COLS.pu.x, y, { width: COLS.pu.w, align: 'right' });
      d.text('P.HT', COLS.pht.x, y, { width: COLS.pht.w, align: 'right' });
      const lineY = y + 12;
      d.moveTo(TABLE_LEFT, lineY).lineTo(TABLE_RIGHT, lineY).strokeColor(LINE).stroke();
      return lineY + 6;
    };

    drawHeader();
    let y = 190;
    y = drawTableHead(y);

    d.font('Helvetica').fontSize(9).fillColor(INK);
    for (const item of voucher.items) {
      if (y > PAGE_BOTTOM) {
        d.addPage();
        y = drawTableHead(40);
        d.font('Helvetica').fontSize(9).fillColor(INK);
      }

      // Case à cocher — cochée si déjà marquée "chargée" dans l'appli,
      // sinon vide pour être cochée à la main lors du chargement physique.
      d.rect(COLS.check.x, y - 1, 9, 9).strokeColor(MUTED).stroke();
      if (item.isLoaded) {
        d.moveTo(COLS.check.x + 1, y + 3.5).lineTo(COLS.check.x + 4, y + 7).lineTo(COLS.check.x + 8, y).strokeColor(INK).stroke();
      }

      d.fillColor(INK);
      d.text(String(item.quantityPackages), COLS.colis.x, y, { width: COLS.colis.w, align: 'right' });
      d.text(String(item.unitsPerPackageSnapshot), COLS.colissage.x, y, { width: COLS.colissage.w, align: 'right' });
      d.text(String(item.actualTotalUnits ?? item.totalUnits), COLS.qte.x, y, { width: COLS.qte.w, align: 'right' });
      d.text(item.product.nameFr, COLS.designation.x, y, { width: COLS.designation.w });
      d.text(num(item.unitPrice).toFixed(2), COLS.pu.x, y, { width: COLS.pu.w, align: 'right' });
      d.text(num(item.lineTotal).toFixed(2), COLS.pht.x, y, { width: COLS.pht.w, align: 'right' });
      y += 18;
    }

    if (y > PAGE_BOTTOM - 120) {
      d.addPage();
      y = 40;
    }

    y += 6;
    d.moveTo(320, y).lineTo(555, y).strokeColor(LINE).stroke();
    y += 10;

    const row = (label: string, value: string, bold = false) => {
      d.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(INK);
      d.text(label, 320, y, { width: 140 });
      d.text(value, 460, y, { width: 95, align: 'right' });
      y += 16;
    };

    row('Nombre de colis', `${totalColis}`);
    row('Total des quantités', `${totalQte}`);
    y += 4;
    row('Sous-total', `${subtotal.toFixed(2)} DA`);
    if (num(voucher.discount) > 0) row('Remise', `-${num(voucher.discount).toFixed(2)} DA`);
    if (num(voucher.transportCost) > 0) row('Transport', `${num(voucher.transportCost).toFixed(2)} DA`);
    row('MONTANT TTC', `${total.toFixed(2)} DA`, true);
    y += 6;
    row('Crédit précédent', `${num(voucher.previousCredit).toFixed(2)} DA`);
    row('Montant payé', `${num(voucher.paidAmount).toFixed(2)} DA`);
    row('Nouveau crédit', `${newCredit.toFixed(2)} DA`, true);

    if (voucher.notes) {
      y += 14;
      d.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text(`Observations : ${voucher.notes}`, 40, y, { width: 515 });
    }

    d.fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(INK)
      .text('MERCI DE VOTRE VISITE EN ESPÉRANT VOUS REVOIR BIENTÔT !', 40, 770, { width: 515, align: 'center' });
    d.fontSize(7)
      .font('Helvetica')
      .fillColor(MUTED)
      .text('Document généré par JIMI PLAST — sans valeur fiscale', 40, 784, { width: 515, align: 'center' });

    d.end();
    return d;
  }
}
