import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface StatementEntryForPdf {
  createdAt: Date;
  typeLabel: string;
  note: string | null;
  amount: number;
  balanceAfter: number;
}

export interface StatementForPdf {
  documentTitle: string;
  partyLabel: string;
  partyName: string;
  partySubtitle: string | null;
  from: Date | null;
  to: Date | null;
  startBalance: number;
  endBalance: number;
  entries: StatementEntryForPdf[];
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

// Date, type, note, montant du mouvement, solde après ce mouvement — le
// principe d'un relevé de compte classique.
const COLS = {
  date: { x: 40, w: 85 },
  type: { x: 125, w: 110 },
  note: { x: 235, w: 170 },
  amount: { x: 405, w: 75 },
  balance: { x: 480, w: 75 },
};
const GRID_X = [40, 125, 235, 405, 480, 555];

/**
 * Génère un relevé de compte (situation) en PDF côté serveur — même
 * grammaire visuelle que les bons de vente/achat, réutilisée telle quelle
 * pour les clients et les fabricants (structure de tableau identique).
 */
@Injectable()
export class StatementPdfService {
  generate(statement: StatementForPdf): PDFKit.PDFDocument {
    const d = new PDFDocument({ size: 'A4', margin: 40 });

    const fmt = (n: number) => `${n.toFixed(2)} DA`;

    const cell = (col: { x: number; w: number }, text: string, y: number, align: 'left' | 'right' = 'left') => {
      d.text(text, col.x + 3, y, { width: col.w - 6, align });
    };

    const drawHeader = () => {
      d.fillColor(ACCENT).fontSize(20).font('Helvetica-Bold').text('JIMI PLAST', 40, 40);
      d.fillColor(MUTED).fontSize(9).font('Helvetica').text('Distribution — plastique & articles ménagers', 40, 64);

      d.fillColor(INK).fontSize(14).font('Helvetica-Bold').text(statement.documentTitle, 300, 40, {
        width: 255,
        align: 'right',
      });
      const period =
        statement.from || statement.to
          ? `Du ${statement.from ? statement.from.toLocaleDateString('fr-FR') : '…'} au ${statement.to ? statement.to.toLocaleDateString('fr-FR') : "aujourd'hui"}`
          : 'Historique complet';
      d.fillColor(MUTED).fontSize(9).font('Helvetica').text(period, 300, 60, { width: 255, align: 'right' });

      d.moveTo(40, 100).lineTo(555, 100).strokeColor(LINE).stroke();

      d.fillColor(INK).fontSize(11).font('Helvetica-Bold').text(statement.partyLabel, 40, 112);
      d.fontSize(10).font('Helvetica').fillColor(INK).text(statement.partyName, 40, 128);
      if (statement.partySubtitle) {
        d.fontSize(9).fillColor(MUTED).text(statement.partySubtitle, 40, 142);
      }
    };

    const drawHeadRow = (y: number) => {
      d.fontSize(8).font('Helvetica-Bold').fillColor(MUTED);
      cell(COLS.date, 'Date', y + 5, 'left');
      cell(COLS.type, 'Type', y + 5, 'left');
      cell(COLS.note, 'Note', y + 5, 'left');
      cell(COLS.amount, 'Montant', y + 5, 'right');
      cell(COLS.balance, 'Solde', y + 5, 'right');
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

    let y = 168;
    let segmentTop = y;
    let boundaries = [y];
    drawHeadRow(y);
    y += HEAD_H;
    boundaries.push(y);

    d.font('Helvetica').fontSize(8.5).fillColor(INK);

    // Ligne "solde initial" — le point de départ du relevé, notamment quand
    // une date de début est fournie et que des mouvements existaient déjà avant.
    const drawStartRow = () => {
      d.font('Helvetica-Oblique').fontSize(8.5).fillColor(MUTED);
      cell(COLS.date, '', y + 5);
      cell(COLS.type, 'Solde initial', y + 5);
      cell(COLS.note, '', y + 5);
      cell(COLS.amount, '', y + 5, 'right');
      d.font('Helvetica-Bold').fillColor(INK);
      cell(COLS.balance, fmt(statement.startBalance), y + 5, 'right');
      y += ROW_H;
      boundaries.push(y);
      d.font('Helvetica').fontSize(8.5).fillColor(INK);
    };
    drawStartRow();

    for (const entry of statement.entries) {
      if (y + ROW_H > PAGE_BOTTOM) {
        drawGrid(segmentTop, boundaries);
        d.addPage();
        y = 40;
        segmentTop = y;
        boundaries = [y];
        drawHeadRow(y);
        y += HEAD_H;
        boundaries.push(y);
        d.font('Helvetica').fontSize(8.5).fillColor(INK);
      }

      d.fillColor(INK);
      cell(COLS.date, entry.createdAt.toLocaleDateString('fr-FR'), y + 5);
      cell(COLS.type, entry.typeLabel, y + 5);
      cell(COLS.note, entry.note ?? '', y + 5);
      d.fillColor(entry.amount > 0 ? ACCENT : '#0f766e');
      cell(COLS.amount, `${entry.amount > 0 ? '+' : ''}${entry.amount.toFixed(2)}`, y + 5, 'right');
      d.fillColor(INK);
      cell(COLS.balance, entry.balanceAfter.toFixed(2), y + 5, 'right');

      y += ROW_H;
      boundaries.push(y);
    }
    drawGrid(segmentTop, boundaries);

    if (y > PAGE_BOTTOM - 70) {
      d.addPage();
      y = 40;
    }

    y += 20;
    d.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Solde final', 40, y);
    d.fontSize(14).text(fmt(statement.endBalance), 40, y + 16);

    d.fontSize(7)
      .font('Helvetica')
      .fillColor(MUTED)
      .text('Document généré par JIMI PLAST — sans valeur fiscale', 40, 784, { width: 515, align: 'center' });

    d.end();
    return d;
  }
}
