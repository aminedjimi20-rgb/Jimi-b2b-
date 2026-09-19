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
const BORDER = '#3a352d';

const TABLE_LEFT = 40;
const TABLE_RIGHT = 555;
const PAGE_BOTTOM = 770;
const HEAD_H = 16;
const ROW_H = 18;

// Colonnes dans l'ordre du bon papier de référence : case à cocher, nombre
// de colis, colissage (pièces/colis), quantité réelle, désignation, prix
// unitaire, total HT. Les bornes de chaque colonne se touchent — ce sont
// aussi les abscisses des traits verticaux de la grille.
const COLS = {
  check: { x: 40, w: 16 },
  colis: { x: 56, w: 37 },
  colissage: { x: 93, w: 48 },
  qte: { x: 141, w: 48 },
  designation: { x: 189, w: 191 },
  pu: { x: 380, w: 60 },
  pht: { x: 440, w: 115 },
};
const GRID_X = [40, 56, 93, 141, 189, 380, 440, 555];

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

    const cell = (col: { x: number; w: number }, text: string, y: number, align: 'left' | 'right' = 'left') => {
      d.text(text, col.x + 3, y, { width: col.w - 6, align });
    };

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

    const drawHeadRow = (y: number) => {
      d.fontSize(8).font('Helvetica-Bold').fillColor(MUTED);
      cell(COLS.colis, 'N.colis', y + 4, 'right');
      cell(COLS.colissage, 'Colissage', y + 4, 'right');
      cell(COLS.qte, 'Qté', y + 4, 'right');
      cell(COLS.designation, 'Désignation', y + 4, 'left');
      cell(COLS.pu, 'P.U', y + 4, 'right');
      cell(COLS.pht, 'P.HT', y + 4, 'right');
    };

    // Dessine la grille (bordure + lignes verticales/horizontales) d'un
    // segment de tableau — un segment par page, puisqu'on ne peut pas tracer
    // de trait continu d'une page à l'autre.
    const drawGrid = (top: number, rowBoundaries: number[]) => {
      const bottom = rowBoundaries[rowBoundaries.length - 1];
      d.lineWidth(0.75).strokeColor(BORDER);
      for (const by of rowBoundaries) {
        d.moveTo(TABLE_LEFT, by).lineTo(TABLE_RIGHT, by).stroke();
      }
      for (const gx of GRID_X) {
        d.moveTo(gx, top).lineTo(gx, bottom).stroke();
      }
      d.lineWidth(1);
    };

    drawHeader();

    let y = 188;
    let segmentTop = y;
    let boundaries = [y];
    drawHeadRow(y);
    y += HEAD_H;
    boundaries.push(y);

    d.font('Helvetica').fontSize(9).fillColor(INK);
    for (const item of voucher.items) {
      if (y + ROW_H > PAGE_BOTTOM) {
        drawGrid(segmentTop, boundaries);
        d.addPage();
        y = 40;
        segmentTop = y;
        boundaries = [y];
        drawHeadRow(y);
        y += HEAD_H;
        boundaries.push(y);
        d.font('Helvetica').fontSize(9).fillColor(INK);
      }

      // Case à cocher — cochée si déjà marquée "chargée" dans l'appli,
      // sinon vide pour être cochée à la main lors du chargement physique.
      const boxY = y + 5;
      d.lineWidth(0.75).rect(COLS.check.x + 4, boxY, 8, 8).strokeColor(MUTED).stroke();
      if (item.isLoaded) {
        d.moveTo(COLS.check.x + 5, boxY + 4).lineTo(COLS.check.x + 7.5, boxY + 7.5).lineTo(COLS.check.x + 11, boxY + 1).strokeColor(INK).stroke();
      }
      d.lineWidth(1);

      d.fillColor(INK);
      cell(COLS.colis, String(item.quantityPackages), y + 5, 'right');
      cell(COLS.colissage, String(item.unitsPerPackageSnapshot), y + 5, 'right');
      cell(COLS.qte, String(item.actualTotalUnits ?? item.totalUnits), y + 5, 'right');
      cell(COLS.designation, item.product.nameFr, y + 5, 'left');
      cell(COLS.pu, num(item.unitPrice).toFixed(2), y + 5, 'right');
      cell(COLS.pht, num(item.lineTotal).toFixed(2), y + 5, 'right');

      y += ROW_H;
      boundaries.push(y);
    }
    drawGrid(segmentTop, boundaries);

    if (y > PAGE_BOTTOM - 130) {
      d.addPage();
      y = 40;
    }

    y += 16;
    const footerTop = y;

    // Trois blocs côte à côte : colisage à gauche, calcul du montant au
    // centre, règlement à droite — plus lisible qu'une longue liste empilée.
    const FOOTER_COL_W = (TABLE_RIGHT - TABLE_LEFT) / 3;
    const col1X = TABLE_LEFT;
    const col2X = TABLE_LEFT + FOOTER_COL_W;
    const col3X = TABLE_LEFT + FOOTER_COL_W * 2;

    const drawColumn = (x: number, rows: { label: string; value: string; bold?: boolean }[]) => {
      let cy = footerTop;
      for (const r of rows) {
        d.font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(r.bold ? INK : MUTED);
        d.text(r.label, x, cy, { width: FOOTER_COL_W - 10 });
        d.font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(r.bold ? 11 : 10).fillColor(INK);
        d.text(r.value, x, cy + 12, { width: FOOTER_COL_W - 10 });
        cy += 30;
      }
      return cy;
    };

    const discountAmount = num(voucher.discount);
    const discountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;

    const middleRows: { label: string; value: string; bold?: boolean }[] = [{ label: 'Sous-total', value: `${subtotal.toFixed(2)} DA` }];
    if (discountAmount > 0) {
      middleRows.push({ label: `Remise (${discountPercent.toFixed(1)} %)`, value: `-${discountAmount.toFixed(2)} DA` });
    }
    if (num(voucher.transportCost) > 0) {
      middleRows.push({ label: 'Transport', value: `${num(voucher.transportCost).toFixed(2)} DA` });
    }
    middleRows.push({ label: 'MONTANT TTC', value: `${total.toFixed(2)} DA`, bold: true });

    const bottom1 = drawColumn(col1X, [
      { label: 'Nombre de colis', value: `${totalColis}` },
      { label: 'Total des quantités', value: `${totalQte}` },
    ]);
    const bottom2 = drawColumn(col2X, middleRows);
    const bottom3 = drawColumn(col3X, [
      { label: 'Crédit précédent', value: `${num(voucher.previousCredit).toFixed(2)} DA` },
      { label: 'Montant payé', value: `${num(voucher.paidAmount).toFixed(2)} DA` },
      { label: 'Nouveau crédit', value: `${newCredit.toFixed(2)} DA`, bold: true },
    ]);

    y = Math.max(bottom1, bottom2, bottom3);

    if (voucher.notes) {
      y += 10;
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
