import { useState } from 'react';

export interface DayGroup<T> {
  key: string;
  level: 'day';
  date: Date;
  rows: T[];
  children?: undefined;
  count: number;
}

export interface PeriodGroup<T> {
  key: string;
  level: 'month' | 'year';
  date: Date;
  children: HierGroup<T>[];
  rows?: undefined;
  count: number;
}

export type HierGroup<T> = DayGroup<T> | PeriodGroup<T>;

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
      group = { key, level: 'day', date: d, rows: [], count: 0 };
      index.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
    group.count++;
  }
  return groups;
}

// Un mois/une année ne s'ajoute au-dessus des jours que si les données en
// couvrent réellement plusieurs — sinon on retombe exactement sur le
// comportement plat actuel (juste des jours), pas de niveau inutile pour
// une courte liste récente.
function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}
function yearKey(d: Date) {
  return `${d.getFullYear()}`;
}

/**
 * Regroupe une liste déjà triée chronologiquement en jours, puis — seulement
 * si nécessaire — en mois, puis en années : dès que les entrées dépassent un
 * mois, les jours se replient sous un mois qu'on déplie pour les voir ; dès
 * qu'elles dépassent une année, les mois se replient sous une année. Chaque
 * niveau se déplie indépendamment (voir useExpandedGroups).
 */
export function groupHierarchical<T>(rows: T[], getDate: (row: T) => string | Date): HierGroup<T>[] {
  const dayGroups = groupByDay(rows, getDate);
  if (dayGroups.length === 0) return [];

  const distinctMonths = new Set(dayGroups.map((g) => monthKey(g.date)));
  if (distinctMonths.size <= 1) return dayGroups;

  const monthGroups: PeriodGroup<T>[] = [];
  const monthIndex = new Map<string, PeriodGroup<T>>();
  for (const day of dayGroups) {
    const key = monthKey(day.date);
    let month = monthIndex.get(key);
    if (!month) {
      month = { key: `m-${key}`, level: 'month', date: day.date, children: [], count: 0 };
      monthIndex.set(key, month);
      monthGroups.push(month);
    }
    month.children.push(day);
    month.count += day.count;
  }

  const distinctYears = new Set(monthGroups.map((g) => yearKey(g.date)));
  if (distinctYears.size <= 1) return monthGroups;

  const yearGroups: PeriodGroup<T>[] = [];
  const yearIndex = new Map<string, PeriodGroup<T>>();
  for (const month of monthGroups) {
    const key = yearKey(month.date);
    let year = yearIndex.get(key);
    if (!year) {
      year = { key: `y-${key}`, level: 'year', date: month.date, children: [], count: 0 };
      yearIndex.set(key, year);
      yearGroups.push(year);
    }
    year.children.push(month);
    year.count += month.count;
  }
  return yearGroups;
}

export function dayGroupLabel(date: Date, locale: string, todayLabel: string, yesterdayLabel: string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return todayLabel;
  if (diffDays === 1) return yesterdayLabel;
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Étiquette d'un groupe à n'importe quel niveau (jour/mois/année). */
export function hierGroupLabel(group: HierGroup<unknown>, locale: string, todayLabel: string, yesterdayLabel: string): string {
  if (group.level === 'day') return dayGroupLabel(group.date, locale, todayLabel, yesterdayLabel);
  if (group.level === 'month') return group.date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return group.date.toLocaleDateString(locale, { year: 'numeric' });
}

/**
 * Déplié/replié par clé — fonctionne à n'importe quelle profondeur d'une
 * hiérarchie (jour/mois/année) puisqu'une seule table d'overrides couvre
 * toutes les clés, quel que soit leur niveau. Le tout premier groupe de haut
 * niveau est déplié par défaut, tout le reste (y compris tout ce qui est
 * imbriqué dessous) est replié tant qu'on ne clique pas dessus.
 */
export function useExpandedGroups(topLevelGroups: { key: string }[]) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const firstKey = topLevelGroups[0]?.key;

  function isExpanded(key: string) {
    if (key in overrides) return overrides[key];
    return key === firstKey;
  }
  function toggle(key: string) {
    setOverrides((prev) => ({ ...prev, [key]: !isExpanded(key) }));
  }
  function setAll(expanded: boolean, keys: string[]) {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = expanded;
      return next;
    });
  }
  const allTopExpanded = topLevelGroups.length > 0 && topLevelGroups.every((g) => isExpanded(g.key));

  // Collecte récursive de toutes les clés d'un arbre — pour "tout déplier"/"tout replier".
  function collectKeys(groups: HierGroup<unknown>[] | { key: string }[]): string[] {
    const keys: string[] = [];
    for (const g of groups as HierGroup<unknown>[]) {
      keys.push(g.key);
      if (g.children) keys.push(...collectKeys(g.children));
    }
    return keys;
  }

  return {
    isExpanded,
    toggle,
    allExpanded: allTopExpanded,
    expandAll: (allGroups: HierGroup<unknown>[]) => setAll(true, collectKeys(allGroups)),
    collapseAll: (allGroups: HierGroup<unknown>[]) => setAll(false, collectKeys(allGroups)),
  };
}
