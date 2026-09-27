import type { ReactNode } from 'react';

/**
 * Couleurs partagées entre la fiche d'un bon (onglet Historique) et la page
 * Historique globale — un coup d'œil doit suffire à repérer un montant, une
 * remise, un changement de produit ou de statut, sans lire toute la ligne.
 */

const ACTION_CLASSES: Record<string, string> = {
  CREATE: 'bg-teal/10 text-teal',
  UPDATE: 'bg-blue-500/10 text-blue-600',
  DELETE: 'bg-red-500/10 text-red-600',
  RESTORE: 'bg-teal/10 text-teal',
  PURGE: 'bg-red-700/10 text-red-700',
  LOGIN: 'bg-line/40 text-muted',
  LOGIN_FAILED: 'bg-red-500/10 text-red-600',
};

export function actionBadgeClass(action: string): string {
  return ACTION_CLASSES[action] ?? 'bg-line/40 text-ink';
}

const FIELD_CLASSES: Record<string, string> = {
  status: 'bg-purple-500/10 text-purple-600',
  items: 'bg-blue-500/10 text-blue-600',
  discount: 'bg-amber-500/10 text-amber-700',
  transportCost: 'bg-orange-500/10 text-orange-700',
  paidAmount: 'bg-emerald-500/10 text-emerald-700',
  currentStock: 'bg-orange-500/10 text-orange-700',
  permissions: 'bg-indigo-500/10 text-indigo-600',
  hidden: 'bg-line/40 text-muted',
  attachment: 'bg-line/40 text-muted',
  itemImage: 'bg-line/40 text-muted',
  notes: 'bg-slate-500/10 text-slate-600',
};

export function fieldBadgeClass(field: string | null | undefined): string {
  if (!field) return 'bg-line/40 text-muted';
  return FIELD_CLASSES[field] ?? 'bg-line/40 text-muted';
}

// Montant (DA), pourcentage, et les libellés de champ les plus fréquents dans
// les textes de raison libres — pas de vraie analyse du texte, juste assez de
// motifs reconnus pour que l'œil retrouve tout de suite le type d'info.
const AMOUNT_RE = /-?\d[\d\s]*(?:[.,]\d+)?\s?DA/g;
const PERCENT_RE = /\d+(?:[.,]\d+)?\s?%/g;

const SEGMENT_COLORS: { test: RegExp; className: string }[] = [
  { test: /^produit (ajouté|retiré)|pièces/i, className: 'text-blue-600' },
  { test: /^remise/i, className: 'text-amber-700' },
  { test: /^transport/i, className: 'text-orange-700' },
  { test: /^montant payé/i, className: 'text-emerald-700' },
  { test: /^photo/i, className: 'text-muted' },
];

function segmentColor(segment: string): string {
  const match = SEGMENT_COLORS.find((s) => s.test.test(segment.trim()));
  return match?.className ?? 'text-ink';
}

/** Découpe puis surligne un texte de raison libre (montants, %, segments par type) sous forme de JSX. */
export function renderHighlightedReason(text: string | null | undefined): ReactNode {
  if (!text) return null;
  const segments = text.split(' | ');

  return segments.map((segment, i) => {
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    const matches: { index: number; length: number; className: string }[] = [];

    for (const m of segment.matchAll(AMOUNT_RE)) {
      matches.push({ index: m.index!, length: m[0].length, className: 'font-semibold text-emerald-700' });
    }
    for (const m of segment.matchAll(PERCENT_RE)) {
      matches.push({ index: m.index!, length: m[0].length, className: 'font-semibold text-amber-700' });
    }
    matches.sort((a, b) => a.index - b.index);

    for (const m of matches) {
      if (m.index < lastIndex) continue; // chevauchement (rare) — on garde le premier
      if (m.index > lastIndex) parts.push(segment.slice(lastIndex, m.index));
      parts.push(
        <span key={`${i}-${m.index}`} className={m.className}>
          {segment.slice(m.index, m.index + m.length)}
        </span>,
      );
      lastIndex = m.index + m.length;
    }
    if (lastIndex < segment.length) parts.push(segment.slice(lastIndex));

    return (
      <span key={i} className={segmentColor(segment)}>
        {parts}
        {i < segments.length - 1 ? ' | ' : ''}
      </span>
    );
  });
}
