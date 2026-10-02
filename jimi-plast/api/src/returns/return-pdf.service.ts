import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface ReturnForPdf {
  number: string | null;
  type: 'CUSTOMER' | 'SUPPLIER';
  status: 'NEW' | 'VALIDATED' | 'REJECTED';
  decision: 'REFUND' | 'CREDIT_NOTE' | 'DEDUCT_NEXT' | 'REPLACEMENT' | null;
  totalValue: unknown;
  createdAt: Date;
  customer?: { businessName: string | null; user: { fullName: string } } | null;
  manufacturer?: { name: string } | null;
  items: {
    product: { nameFr: string };
    quantity: number;
    reason: string;
    condition: string;
    unitPrice: unknown;
    lineTotal: unknown;
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

const COLS = {
  designation: { x: 40, w: 190 },
  qte: { x: 230, w: 45 },
  raison: { x: 275, w: 140 },
  etat: { x: 415, w: 60 },
  pu: { x: 475, w: 40 },
  total: { x: 515, w: 40 },
};
const GRID_X = [40, 230, 275, 415, 475, 515, 555];

const DECISION_LABEL: Record<string, string> = {
  REFUND: 'Remboursement',
  CREDIT_NOTE: 'Avoir',
  DEDUCT_NEXT: 'Déduction prochain bon',
  REPLACEMENT: 'Remplacement',
};
const STATUS_LABEL: Record<string, string> = { NEW: 'Nouveau', VALIDATED: 'Validé', REJECTED: 'Refusé' };
const CONDITION_LABEL: Record<string, string> = { DAMAGED: 'Endommagé', DEFECTIVE: 'Défectueux', OTHER: 'Autre' };

@Injectable()
export class ReturnPdfService {
  generate(ret: ReturnForPdf): PDFKit.PDFDocument {
    const d = new PDFDocument({ size: 'A4', margin: 40 });
    const num = (v: unknown) => Number(v ?? 0);

    const cell = (col: { x: number; w: number }, text: string, y: number, align: 'left' | 'right' = 'left') => {
      d.text(text, col.x + 3, y, { width: col.w - 6, align });
    };

    const partyName = ret.type === 'CUSTOMER' ? ret.customer?.businessName ?? ret.customer?.user.fullName ?? '' : ret.manufacturer?.name ?? '';
    const partyLabel = ret.type === 'CUSTOMER' ? 'Client' : 'Fabricant';

    d.fillColor(ACCENT).fontSize(20).font('Helvetica-Bold').text('JIMI PLAST', 40, 40);
    d.fillColor(MUTED).fontSize(9).font('Helvetica').text('Distribution — plastique & articles ménagers', 40, 64);

    d.fillColor(INK).fontSize(14).font('Helvetica-Bold').text(`BON DE RETOUR ${ret.number ?? '(en attente)'}`, 300, 40, { width: 255, align: 'right' });
    d.fillColor(MUTED)
      .fontSize(9)
      .font('Helvetica')
      .text(`Date : ${ret.createdAt.toLocaleDateString('fr-FR')}`, 300, 60, { width: 255, align: 'right' })
      .text(`Statut : ${STATUS_LABEL[ret.status] ?? ret.status}`, 300, 74, { width: 255, align: 'right' });

    d.moveTo(40, 100).lineTo(555, 100).strokeColor(LINE).stroke();

    d.fillColor(INK).fontSize(11).font('Helvetica-Bold').text(partyLabel, 40, 112);
    d.fontSize(10).font('Helvetica').text(partyName, 40, 128);

    let y = 160;
    let segmentTop = y;
    let boundaries = [y];

    const drawHeadRow = (yy: number) => {
      d.fontSize(8).font('Helvetica-Bold').fillColor(MUTED);
      cell(COLS.designation, 'Désignation', yy + 4, 'left');
      cell(COLS.qte, 'Qté', yy + 4, 'right');
      cell(COLS.raison, 'Raison', yy + 4, 'left');
      cell(COLS.etat, 'État', yy + 4, 'left');
      cell(COLS.pu, 'P.U', yy + 4, 'right');
      cell(COLS.total, 'Total', yy + 4, 'right');
    };

    const drawGrid = (top: number, rowBoundaries: number[]) => {
      const bottom = rowBoundaries[rowBoundaries.length - 1];
      d.lineWidth(0.75).strokeColor(BORDER);
      for (const by of rowBoundaries) d.moveTo(TABLE_LEFT, by).lineTo(TABLE_RIGHT, by).stroke();
      for (const gx of GRID_X) d.moveTo(gx, top).lineTo(gx, bottom).stroke();
      d.lineWidth(1);
    };

    drawHeadRow(y);
    y += HEAD_H;
    boundaries.push(y);

    d.font('Helvetica').fontSize(9).fillColor(INK);
    for (const item of ret.items) {
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
      cell(COLS.designation, item.product.nameFr, y + 5, 'left');
      cell(COLS.qte, String(item.quantity), y + 5, 'right');
      cell(COLS.raison, item.reason, y + 5, 'left');
      cell(COLS.etat, CONDITION_LABEL[item.condition] ?? item.condition, y + 5, 'left');
      cell(COLS.pu, num(item.unitPrice).toFixed(2), y + 5, 'right');
      cell(COLS.total, num(item.lineTotal).toFixed(2), y + 5, 'right');
      y += ROW_H;
      boundaries.push(y);
    }
    drawGrid(segmentTop, boundaries);

    y += 20;
    if (y > PAGE_BOTTOM - 60) {
      d.addPage();
      y = 40;
    }

    d.font('Helvetica').fontSize(10).fillColor(MUTED);
    if (ret.decision) d.text(`Décision : ${DECISION_LABEL[ret.decision] ?? ret.decision}`, 40, y, { width: 300 });
    d.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(`TOTAL : ${num(ret.totalValue).toFixed(2)} DA`, 300, y, { width: 215, align: 'right' });

    d.fontSize(7).font('Helvetica').fillColor(MUTED).text('Document généré par JIMI PLAST — sans valeur fiscale', 40, 784, { width: 515, align: 'center' });

    d.end();
    return d;
  }
}
