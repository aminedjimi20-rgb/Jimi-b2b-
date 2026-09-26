import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface Situation {
  from: string;
  to: string;
  salesRevenue: number;
  salesCOGS: number;
  grossMargin: number;
  purchaseSpend: number;
  totalExpenses: number;
  expensesByCategory: { name: string; amount: number }[];
  totalDeliveryPayouts: number;
  netProfit: number;
  customerDebt: number;
  supplierDebt: number;
  customerPaymentsReceived: number;
  manufacturerPaymentsPaid: number;
  remainingStockUnits: number;
  remainingStockValue: number;
}

const ACCENT = '#d9641f';
const INK = '#201d1a';
const MUTED = '#78705f';
const LINE = '#e1dbca';
const TEAL = '#1f8a70';

@Injectable()
export class SituationPdfService {
  generate(s: Situation): PDFKit.PDFDocument {
    const d = new PDFDocument({ size: 'A4', margin: 40 });
    const money = (n: number) => `${n.toLocaleString('fr-FR')} DA`;

    d.fillColor(ACCENT).fontSize(20).font('Helvetica-Bold').text('JIMI PLAST', 40, 40);
    d.fillColor(MUTED).fontSize(9).font('Helvetica').text('Situation — usage personnel, sans valeur fiscale', 40, 64);
    d.fillColor(INK).fontSize(14).font('Helvetica-Bold').text('MA SITUATION', 300, 40, { width: 255, align: 'right' });
    d.fillColor(MUTED).fontSize(9).font('Helvetica').text(`Période : ${s.from} → ${s.to}`, 300, 60, { width: 255, align: 'right' });

    d.moveTo(40, 90).lineTo(555, 90).strokeColor(LINE).stroke();

    let y = 110;
    const row = (label: string, value: string, opts: { bold?: boolean; color?: string } = {}) => {
      d.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 11 : 10).fillColor(opts.color ?? INK);
      d.text(label, 40, y, { width: 350 });
      d.text(value, 400, y, { width: 155, align: 'right' });
      y += opts.bold ? 22 : 18;
    };
    const section = (title: string) => {
      y += 6;
      d.font('Helvetica-Bold').fontSize(10).fillColor(ACCENT).text(title, 40, y);
      y += 16;
    };

    section('Ventes');
    row('Chiffre d’affaires', money(s.salesRevenue));
    row('Coût des marchandises vendues', `-${money(s.salesCOGS)}`);
    row('Marge brute', money(s.grossMargin), { bold: true });

    section('Achats');
    row('Achats fabricants (période)', money(s.purchaseSpend));

    section('Frais généraux');
    for (const c of s.expensesByCategory) row(c.name, money(c.amount));
    row('Total des frais', money(s.totalExpenses), { bold: true });

    // Jamais mélangé aux Frais : ce montant est déjà facturé au client/
    // fabricant sur son bon — c'est le coût réel payé au livreur.
    section('Paiements chauffeurs (livraisons liées à un bon)');
    row('Total', money(s.totalDeliveryPayouts));

    y += 10;
    d.moveTo(40, y).lineTo(555, y).strokeColor(LINE).stroke();
    y += 14;
    row('RÉSULTAT NET', money(s.netProfit), { bold: true, color: s.netProfit >= 0 ? TEAL : ACCENT });

    section('Comptes (solde actuel)');
    row('Dû par mes clients', money(s.customerDebt));
    row('Dû aux fabricants', money(s.supplierDebt));
    row('Encaissé de mes clients (période)', money(s.customerPaymentsReceived));
    row('Payé aux fabricants (période)', money(s.manufacturerPaymentsPaid));

    section('Stock non vendu (valeur actuelle)');
    row('Quantité en stock', `${s.remainingStockUnits.toLocaleString('fr-FR')} pièces`);
    row('Valeur au prix de revient', money(s.remainingStockValue));

    d.fontSize(7).font('Helvetica').fillColor(MUTED).text('Document interne JIMI PLAST — usage personnel', 40, 784, { width: 515, align: 'center' });

    d.end();
    return d;
  }
}
