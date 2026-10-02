'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

export interface AttendanceEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  markedAt: string;
  confirmedAt: string | null;
  confirmedById: string | null;
  confirmedBy?: { fullName: string } | null;
  hiddenAt: string | null;
}

interface Props {
  entries: AttendanceEntry[];
  mode: 'self' | 'admin';
  locale: string;
  onMark?: (date: string) => void;
  onUnmark?: (date: string) => void;
  onConfirm?: (date: string) => void;
  onUnconfirm?: (date: string) => void;
  onToggleHidden?: (id: string, hidden: boolean) => void;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Calendrier de pointage partagé — la vue de l'employé (mode "self", clic
 * pour cocher/décocher) et celle de l'administrateur (mode "admin",
 * confirmer/annuler/cacher) sont volontairement le même composant : ce que
 * l'un voit doit être exactement ce que l'autre voit.
 */
export function AttendanceCalendar({ entries, mode, locale, onMark, onUnmark, onConfirm, onUnconfirm, onToggleHidden }: Props) {
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [showHidden, setShowHidden] = useState(false);

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceEntry>();
    for (const e of entries) map.set(e.date, e);
    return map;
  }, [entries]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = ymd(new Date());

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(new Date(year, month, d)));

  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, 1); // un lundi
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  function cellClass(entry: AttendanceEntry | undefined, dateStr: string) {
    if (entry?.hiddenAt) return showHidden ? 'border-line bg-line/20 opacity-50' : 'border-line/60';
    if (entry?.confirmedAt) return 'border-teal/50 bg-teal/15';
    if (entry) return 'border-amber-400/60 bg-amber-500/15';
    return dateStr === todayStr ? 'border-accent/60' : 'border-line';
  }

  function handleClick(dateStr: string) {
    if (mode !== 'self' || dateStr > todayStr) return;
    const entry = byDate.get(dateStr);
    if (entry) {
      if (!entry.confirmedAt) onUnmark?.(dateStr);
    } else {
      onMark?.(dateStr);
    }
  }

  const monthEntries = useMemo(
    () =>
      entries
        .filter((e) => e.date.slice(0, 7) === `${year}-${pad(month + 1)}`)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, year, month],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="rounded border border-line px-2 py-1 text-sm hover:bg-line/30">
          ‹
        </button>
        <span className="text-sm font-semibold capitalize text-ink">{viewDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="rounded border border-line px-2 py-1 text-sm hover:bg-line/30">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase text-muted">
        {weekdayLabels.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} />;
          const entry = byDate.get(dateStr);
          const dayNum = Number(dateStr.slice(8));
          const clickable = mode === 'self' && dateStr <= todayStr && !entry?.confirmedAt;
          return (
            <button
              key={dateStr}
              type="button"
              aria-label={dateStr}
              onClick={() => handleClick(dateStr)}
              disabled={mode === 'self' && !clickable}
              className={`flex h-11 flex-col items-center justify-center rounded border text-xs transition ${cellClass(entry, dateStr)} ${
                clickable ? 'cursor-pointer hover:brightness-95' : mode === 'self' ? 'cursor-not-allowed' : ''
              }`}
            >
              <span className={dateStr === todayStr ? 'font-bold text-accent' : 'text-ink'}>{dayNum}</span>
              {entry && !entry.hiddenAt && <span className="text-[10px] leading-none">{entry.confirmedAt ? '✓✓' : '✓'}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-amber-400/60 bg-amber-500/15" /> {t('legendMarked')}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-teal/50 bg-teal/15" /> {t('legendConfirmed')}
        </span>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          {t('showHidden')}
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        {monthEntries.filter((e) => showHidden || !e.hiddenAt).length === 0 && (
          <p className="text-xs text-muted">{tCommon('empty')}</p>
        )}
        {monthEntries
          .filter((e) => showHidden || !e.hiddenAt)
          .map((e) => (
            <div
              key={e.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-1.5 text-xs ${
                e.hiddenAt ? 'border-line/60 opacity-50' : e.confirmedAt ? 'border-teal/30 bg-teal/5' : 'border-amber-400/40 bg-amber-500/5'
              }`}
            >
              <span className="text-ink">
                <span className="font-medium">{new Date(e.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                {' — '}
                {t('markedTooltip', { time: new Date(e.markedAt).toLocaleTimeString(locale) })}
                {e.confirmedAt && (
                  <>
                    {' · '}
                    {t('confirmedTooltip', { name: e.confirmedBy?.fullName ?? '', time: new Date(e.confirmedAt).toLocaleTimeString(locale) })}
                  </>
                )}
              </span>
              <div className="flex items-center gap-2">
                {mode === 'admin' && !e.confirmedAt && !e.hiddenAt && (
                  <button onClick={() => onConfirm?.(e.date)} className="rounded bg-teal px-2 py-1 font-medium text-white">
                    {t('confirm')}
                  </button>
                )}
                {mode === 'admin' && e.confirmedAt && !e.hiddenAt && (
                  <button onClick={() => onUnconfirm?.(e.date)} className="text-red-600 hover:underline">
                    {t('unconfirm')}
                  </button>
                )}
                {onToggleHidden && (
                  <button onClick={() => onToggleHidden(e.id, !e.hiddenAt)} className="text-accent hover:underline">
                    {e.hiddenAt ? t('unhide') : t('hide')}
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
