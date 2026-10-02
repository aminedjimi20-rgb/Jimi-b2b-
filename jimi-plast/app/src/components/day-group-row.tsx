'use client';

import { Fragment, type ReactNode } from 'react';
import type { HierGroup } from '@/lib/date-groups';
import { hierGroupLabel } from '@/lib/date-groups';

export function DayGroupToggleAll({
  allExpanded,
  onExpandAll,
  onCollapseAll,
  expandLabel,
  collapseLabel,
}: {
  allExpanded: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={allExpanded ? onCollapseAll : onExpandAll}
      className="rounded border border-line px-3 py-1.5 text-xs text-ink hover:bg-line/30"
    >
      {allExpanded ? collapseLabel : expandLabel}
    </button>
  );
}

export function DayGroupRow({
  label,
  count,
  colSpan,
  expanded,
  onToggle,
  level = 'day',
}: {
  label: string;
  count: number;
  colSpan: number;
  expanded: boolean;
  onToggle: () => void;
  /** "year"/"month" s'affichent en plus gras, légèrement plus marqués que "day". */
  level?: 'day' | 'month' | 'year';
}) {
  const indent = level === 'day' ? 0 : level === 'month' ? 1 : 0;
  return (
    <tr onClick={onToggle} className={`cursor-pointer select-none border-t border-line hover:bg-line/20 ${level === 'year' ? 'bg-line/20' : level === 'month' ? 'bg-line/15' : 'bg-line/10'}`}>
      <td colSpan={colSpan} className="px-4 py-2" style={indent ? { paddingInlineStart: `${1 + indent * 1.25}rem` } : undefined}>
        <div className={`flex items-center gap-2 text-xs ${level === 'year' ? 'font-bold' : 'font-semibold'} text-ink`}>
          <span className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
          <span>{label}</span>
          <span className="text-muted">({count})</span>
        </div>
      </td>
    </tr>
  );
}

interface RecursiveProps<T> {
  groups: HierGroup<T>[];
  renderRow: (row: T) => ReactNode;
  isExpanded: (key: string) => boolean;
  toggle: (key: string) => void;
  colSpan: number;
  locale: string;
  todayLabel: string;
  yesterdayLabel: string;
}

/**
 * Rend une hiérarchie jour/mois/année sous forme de lignes de tableau — un
 * groupe mois/année ne montre ses enfants (récursivement) que déplié.
 * Remplace le `.map` répété dans chaque page qui utilisait groupByDay seul.
 */
export function HierGroupRows<T>({ groups, renderRow, isExpanded, toggle, colSpan, locale, todayLabel, yesterdayLabel }: RecursiveProps<T>) {
  return (
    <>
      {groups.map((group) => {
        const expanded = isExpanded(group.key);
        return (
          <Fragment key={group.key}>
            <DayGroupRow
              label={hierGroupLabel(group, locale, todayLabel, yesterdayLabel)}
              count={group.count}
              colSpan={colSpan}
              expanded={expanded}
              onToggle={() => toggle(group.key)}
              level={group.level}
            />
            {expanded && group.level === 'day' && group.rows.map((row) => renderRow(row))}
            {expanded && group.level !== 'day' && (
              <HierGroupRows
                groups={group.children}
                renderRow={renderRow}
                isExpanded={isExpanded}
                toggle={toggle}
                colSpan={colSpan}
                locale={locale}
                todayLabel={todayLabel}
                yesterdayLabel={yesterdayLabel}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * Même hiérarchie jour/mois/année que HierGroupRows, mais en blocs div/bouton
 * plutôt qu'en lignes de tableau — pour les listes en cartes (Notes, journal
 * d'activité d'un employé...).
 */
export function HierGroupBlocks<T>({ groups, renderRow, isExpanded, toggle, locale, todayLabel, yesterdayLabel, depth = 0 }: Omit<RecursiveProps<T>, 'colSpan'> & { depth?: number }) {
  return (
    <>
      {groups.map((group) => {
        const expanded = isExpanded(group.key);
        return (
          <Fragment key={group.key}>
            <button
              onClick={() => toggle(group.key)}
              style={depth ? { paddingInlineStart: `${depth * 1.25}rem` } : undefined}
              className={`flex w-full items-center gap-2 border-t border-line py-2 text-start text-xs first:border-t-0 ${
                group.level === 'year' ? 'font-bold' : 'font-semibold'
              } text-ink`}
            >
              <span className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
              <span>{hierGroupLabel(group, locale, todayLabel, yesterdayLabel)}</span>
              <span className="text-muted">({group.count})</span>
            </button>
            {expanded && group.level === 'day' && (
              <ul className="flex flex-col gap-2 pb-3 ps-6">{group.rows.map((row) => renderRow(row))}</ul>
            )}
            {expanded && group.level !== 'day' && (
              <div className="ps-3">
                <HierGroupBlocks
                  groups={group.children}
                  renderRow={renderRow}
                  isExpanded={isExpanded}
                  toggle={toggle}
                  locale={locale}
                  todayLabel={todayLabel}
                  yesterdayLabel={yesterdayLabel}
                  depth={depth + 1}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
