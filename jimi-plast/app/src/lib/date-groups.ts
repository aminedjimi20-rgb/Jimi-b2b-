import { useState } from 'react';

export interface DayGroup<T> {
  key: string;
  date: Date;
  rows: T[];
}

/** Groups consecutive-in-array rows by calendar day (local time). Meant for lists already
 * sorted chronologically — if the same day's rows aren't contiguous, it will produce
 * multiple groups for that day. */
export function groupByDay<T>(rows: T[], getDate: (row: T) => string | Date): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  const index = new Map<string, DayGroup<T>>();
  for (const row of rows) {
    const d = new Date(getDate(row));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let group = index.get(key);
    if (!group) {
      group = { key, date: d, rows: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

export function dayGroupLabel(date: Date, locale: string, todayLabel: string, yesterdayLabel: string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return todayLabel;
  if (diffDays === 1) return yesterdayLabel;
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** First group open by default, the rest collapsed, each toggle independent of the others. */
export function useExpandedGroups(groups: { key: string }[]) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  function isExpanded(idx: number) {
    const key = groups[idx]?.key;
    if (key === undefined) return false;
    if (key in overrides) return overrides[key];
    return idx === 0;
  }
  function toggle(idx: number) {
    const key = groups[idx]?.key;
    if (key === undefined) return;
    setOverrides((prev) => ({ ...prev, [key]: !isExpanded(idx) }));
  }
  return { isExpanded, toggle };
}
