import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface InvoiceForPdf {
  number: string;
  createdAt: Date;
  voucher: {
    number: string | null;
    createdAt: Date;
    customer:
      | {
          businessName: string | null;
          rc: string | null;
          nif: string | null;
          nis: string | null;
          ai: string | null;
          user: { fullName: string; phone: string | null };
        }
      | null;
    discount: unknown;
    transportCost: unknown;
    paidAmount: unknown;
    items: {
      product: { nameFr: string };
      packagingUnit: { label: string };
      quantityPackages: number;
      actualTotalUnits: number | null;
      totalUnits: number;
      unitPrice: unknown;
      lineTotal: unknown;
    }[];
  };
  company: {
    companyLegalName: string | null;
    companyAddress: string | null;
    companyPhone: string | null;
    companyRC: string | null;
    companyNIF: string | null;
    companyNIS: string | null;
    companyAI: string | null;
  };
}

const ACCENT = '#d9641f';
const INK = '#201d1a';
const MUTED = '#78705f';
const LINE = '#e1dbca';
const BORDER = '#3a352d';

const TABLE_LEFT = 40;
const TABLE_RIGHT = 555;
const PAGE_BOTTOM = 770;
const HEAD_H = 18;
const ROW_H = 20;

const COLS = {
  designation: { x: 40, w: 245 },
  qte: { x: 285, w: 65 },
  pu: { x: 350, w: 90 },
  total: { x: 440, w: 115 },
};
const GRID_X = [40, 285, 350, 440, 555];

/**
 * Facture officielle liée à un bon confirmé — document distinct du bon de
 * livraison (voir voucher-pdf.service.ts), qui reste "sans valeur fiscale".
 * Toujours générée depuis un enregistrement Invoice déjà créé (numéro
 * stable), jamais recalculée à la volée.
 */
@Injectable()
export class InvoicePdfService {
  generate(data: InvoiceForPdf): PDFKit.PDFDocument {
    const d = new PDFDocument({ size: 'A4', margin: 40 });
    const { voucher, company } = data;

    const num = (v: unknown) => Number(v ?? 0);
    const subtotal = voucher.items.reduce((s, i) => s + num(i.lineTotal), 0);
    const discountAmount = num(voucher.discount);
    const total = subtotal - discountAmount + num(voucher.transportCost);

    const cell = (col: { x: number; w: number }, text: string, y: number, align: 'left' | 'right' = 'left') => {
      d.text(text, col.x + 3, y, { width: col.w - 6, align });
    };

    const companyName = company.companyLegalName || 'JIMI PLAST';

    const drawHeader = () => {
      d.fillColor(ACCENT).fontSize(20).font('Helvetica-Bold').text(companyName, 40, 40);
      let infoY = 64;
      d.fillColor(MUTED).fontSize(8).font('Helvetica');
      if (company.companyAddress) {
        d.text(company.companyAddress, 40, infoY, { width: 260 });
        infoY += 12;
      }
      if (company.companyPhone) {
        d.text(`Tél : ${company.companyPhone}`, 40, infoY, { width: 260 });
        infoY += 12;
      }
      const legalBits = [
        company.companyRC && `RC : ${company.companyRC}`,
        company.companyNIF && `NIF : ${company.companyNIF}`,
        company.companyNIS && `NIS : ${company.companyNIS}`,
        company.companyAI && `AI : ${company.companyAI}`,
      ].filter(Boolean) as string[];
      if (legalBits.length > 0) {
        d.text(legalBits.join('  —  '), 40, infoY, { width: 320 });
      }

      d.fillColor(INK).fontSize(16).font('Helvetica-Bold').text('FACTURE', 300, 40, { width: 255, align: 'right' });
      d.fillColor(MUTED)
        .fontSize(9)
        .font('Helvetica')
        .text(`N° ${data.number}`, 300, 62, { width: 255, align: 'right' })
        .text(`Date : ${data.createdAt.toLocaleDateString('fr-FR')}`, 300, 76, { width: 255, align: 'right' })
        .text(`Réf. bon : ${voucher.number ?? ''}`, 300, 90, { width: 255, align: 'right' });

      d.moveTo(40, 118).lineTo(555, 118).strokeColor(LINE).stroke();

      d.fillColor(INK).fontSize(11).font('Helvetica-Bold').text('Facturé à', 40, 130);
      if (voucher.customer) {
        d.fontSize(10)
          .font('Helvetica')
          .text(voucher.customer.businessName ?? voucher.customer.user.fullName, 40, 146)
          .text(voucher.customer.user.fullName, 40, 160)
          .text(voucher.customer.user.phone ?? '', 40, 174);

        const customerLegalBits = [
          voucher.customer.rc && `RC : ${voucher.customer.rc}`,
          voucher.customer.nif && `NIF : ${voucher.customer.nif}`,
          voucher.customer.nis && `NIS : ${voucher.customer.nis}`,
          voucher.customer.ai && `AI : ${voucher.customer.ai}`,
        ].filter(Boolean) as string[];
        if (customerLegalBits.length > 0) {
          d.fillColor(MUTED).fontSize(8).font('Helvetica').text(customerLegalBits.join('  —  '), 40, 190, { width: 320 });
        }
      }
    };

    const drawHeadRow = (y: number) => {
      d.fontSize(8).font('Helvetica-Bold').fillColor(MUTED);
      cell(COLS.designation, 'Désignation', y + 5, 'left');
      cell(COLS.qte, 'Qté', y + 5, 'right');
      cell(COLS.pu, 'P.U (DA)', y + 5, 'right');
      cell(COLS.total, 'Montant (DA)', y + 5, 'right');
    };

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

    let y = 218;
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

      const qty = item.actualTotalUnits ?? item.totalUnits;
      cell(COLS.designation, item.product.nameFr, y + 6, 'left');
      cell(COLS.qte, String(qty), y + 6, 'right');
      cell(COLS.pu, num(item.unitPrice).toFixed(2), y + 6, 'right');
      cell(COLS.total, num(item.lineTotal).toFixed(2), y + 6, 'right');

      y += ROW_H;
      boundaries.push(y);
    }
    drawGrid(segmentTop, boundaries);

    if (y > PAGE_BOTTOM - 110) {
      d.addPage();
      y = 40;
    }

    y += 20;
    const totalsX = 340;
    const totalsW = TABLE_RIGHT - totalsX;

    const row = (label: string, value: string, bold = false) => {
      d.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9).fillColor(bold ? INK : MUTED);
      d.text(label, totalsX, y, { width: totalsW - 90 });
      d.text(value, totalsX + totalsW - 90, y, { width: 90, align: 'right' });
      y += bold ? 18 : 14;
    };

    row('Sous-total HT', `${subtotal.toFixed(2)} DA`);
    if (discountAmount > 0) row('Remise', `-${discountAmount.toFixed(2)} DA`);
    if (num(voucher.transportCost) > 0) row('Transport', `${num(voucher.transportCost).toFixed(2)} DA`);
    d.moveTo(totalsX, y).lineTo(TABLE_RIGHT, y).strokeColor(LINE).stroke();
    y += 6;
    row('TOTAL NET À PAYER', `${total.toFixed(2)} DA`, true);

    d.fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(INK)
      .text('Merci de votre confiance.', 40, 770, { width: 515, align: 'center' });

    d.end();
    return d;
  }
}
