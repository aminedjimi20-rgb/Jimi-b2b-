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
    unitPrice: unknown;
    lineTotal: unknown;
  }[];
}

const ACCENT = '#d9641f';
const INK = '#201d1a';
const MUTED = '#78705f';
const LINE = '#e1dbca';

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

    d.fillColor(INK).fontSize(11).font('Helvetica-Bold').text('Client', 40, 112);
    d.fontSize(10)
      .font('Helvetica')
      .text(voucher.customer.businessName ?? voucher.customer.user.fullName, 40, 128)
      .text(voucher.customer.user.fullName, 40, 142)
      .text(voucher.customer.user.phone ?? '', 40, 156);

    let y = 190;
    d.fontSize(9).font('Helvetica-Bold').fillColor(MUTED);
    d.text('Produit', 40, y);
    d.text('Cond.', 260, y, { width: 70 });
    d.text('Pièces', 330, y, { width: 50, align: 'right' });
    d.text('P.U.', 385, y, { width: 60, align: 'right' });
    d.text('Total', 480, y, { width: 75, align: 'right' });
    y += 14;
    d.moveTo(40, y).lineTo(555, y).strokeColor(LINE).stroke();
    y += 8;

    d.font('Helvetica').fillColor(INK);
    for (const item of voucher.items) {
      d.text(item.product.nameFr, 40, y, { width: 210 });
      d.text(`${item.quantityPackages} ${item.packagingUnit.label}`, 260, y, { width: 70 });
      d.text(`${item.totalUnits}`, 330, y, { width: 50, align: 'right' });
      d.text(`${num(item.unitPrice).toFixed(2)}`, 385, y, { width: 60, align: 'right' });
      d.text(`${num(item.lineTotal).toFixed(2)}`, 480, y, { width: 75, align: 'right' });
      y += 18;
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

    row('Sous-total', `${subtotal.toFixed(2)} DA`);
    if (num(voucher.discount) > 0) row('Remise', `-${num(voucher.discount).toFixed(2)} DA`);
    if (num(voucher.transportCost) > 0) row('Transport', `${num(voucher.transportCost).toFixed(2)} DA`);
    row('TOTAL', `${total.toFixed(2)} DA`, true);
    y += 6;
    row('Crédit précédent', `${num(voucher.previousCredit).toFixed(2)} DA`);
    row('Montant payé', `${num(voucher.paidAmount).toFixed(2)} DA`);
    row('Nouveau crédit', `${newCredit.toFixed(2)} DA`, true);

    if (voucher.notes) {
      y += 14;
      d.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text(`Observations : ${voucher.notes}`, 40, y, { width: 515 });
    }

    d.fontSize(8)
      .fillColor(MUTED)
      .text('Document généré par JIMI PLAST — sans valeur fiscale', 40, 780, { width: 515, align: 'center' });

    d.end();
    return d;
  }
}
