import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface ExpenseForPdf {
  date: Date;
  category: { name: string };
  amount: unknown;
  notes: string | null;
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
  date: { x: 40, w: 80 },
  category: { x: 120, w: 140 },
  notes: { x: 260, w: 215 },
  amount: { x: 475, w: 80 },
};
const GRID_X = [40, 120, 260, 475, 555];

@Injectable()
export class ExpensePdfService {
  generate(expenses: ExpenseForPdf[], from: string, to: string): PDFKit.PDFDocument {
    const d = new PDFDocument({ size: 'A4', margin: 40 });
    const num = (v: unknown) => Number(v ?? 0);
    const total = expenses.reduce((s, e) => s + num(e.amount), 0);

    const cell = (col: { x: number; w: number }, text: string, y: number, align: 'left' | 'right' = 'left') => {
      d.text(text, col.x + 3, y, { width: col.w - 6, align });
    };

    d.fillColor(ACCENT).fontSize(20).font('Helvetica-Bold').text('JIMI PLAST', 40, 40);
    d.fillColor(MUTED).fontSize(9).font('Helvetica').text('Distribution — plastique & articles ménagers', 40, 64);
    d.fillColor(INK).fontSize(14).font('Helvetica-Bold').text('RELEVÉ DES FRAIS', 300, 40, { width: 255, align: 'right' });
    d.fillColor(MUTED).fontSize(9).font('Helvetica').text(`Période : ${from} → ${to}`, 300, 60, { width: 255, align: 'right' });

    d.moveTo(40, 90).lineTo(555, 90).strokeColor(LINE).stroke();

    let y = 105;
    let segmentTop = y;
    let boundaries = [y];

    const drawHeadRow = (yy: number) => {
      d.fontSize(8).font('Helvetica-Bold').fillColor(MUTED);
      cell(COLS.date, 'Date', yy + 4, 'left');
      cell(COLS.category, 'Catégorie', yy + 4, 'left');
      cell(COLS.notes, 'Observation', yy + 4, 'left');
      cell(COLS.amount, 'Montant', yy + 4, 'right');
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
    for (const e of expenses) {
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
      cell(COLS.date, e.date.toLocaleDateString('fr-FR'), y + 5, 'left');
      cell(COLS.category, e.category.name, y + 5, 'left');
      cell(COLS.notes, e.notes ?? '', y + 5, 'left');
      cell(COLS.amount, `${num(e.amount).toFixed(2)} DA`, y + 5, 'right');
      y += ROW_H;
      boundaries.push(y);
    }
    drawGrid(segmentTop, boundaries);

    y += 16;
    if (y > PAGE_BOTTOM - 40) {
      d.addPage();
      y = 40;
    }
    d.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(`TOTAL : ${total.toFixed(2)} DA`, 300, y, { width: 215, align: 'right' });

    d.fontSize(7).font('Helvetica').fillColor(MUTED).text('Document interne JIMI PLAST — usage personnel', 40, 784, { width: 515, align: 'center' });

    d.end();
    return d;
  }
}
