'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { DayGroupRow, DayGroupToggleAll } from '@/components/day-group-row';
import { dayGroupLabel, groupByDay, useExpandedGroups } from '@/lib/date-groups';
import { actionBadgeClass, fieldBadgeClass, renderHighlightedReason } from '@/lib/history-colors';

interface AuditLogRow {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  hiddenAt: string | null;
  actor: { id: string; fullName: string } | null;
}

function truncate(v: string | null, max = 80) {
  if (!v) return '';
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

export default function HistoryPage() {
  const t = useTranslations('history');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();

  const [entries, setEntries] = useState<AuditLogRow[]>([]);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  function reload() {
    if (!token) return;
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (showHidden) params.set('includeHidden', 'true');
    const qs = params.toString();
    api.get<AuditLogRow[]>(`/history${qs ? `?${qs}` : ''}`, token).then(setEntries);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, showHidden]);

  async function toggleHidden(e: AuditLogRow) {
    await api.put(`/history/${e.id}/hide`, { hidden: !e.hiddenAt }, token);
    reload();
  }

  const dayGroups = useMemo(() => groupByDay(entries, (e) => e.createdAt), [entries]);
  const { isExpanded, toggle, allExpanded, expandAll, collapseAll } = useExpandedGroups(dayGroups);

  function renderRow(e: AuditLogRow) {
    return (
      <tr key={e.id} className={`border-t border-line ${e.hiddenAt ? 'opacity-50' : ''}`}>
        <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(e.createdAt).toLocaleTimeString(locale)}</td>
        <td className="px-4 py-2 text-ink">{e.entityType}</td>
        <td className="px-4 py-2">
          <span className={`rounded-full px-2 py-0.5 text-xs ${actionBadgeClass(e.action)}`}>{t(`actions.${e.action}` as never)}</span>
        </td>
        <td className="px-4 py-2 text-muted">{e.actor?.fullName ?? t('system')}</td>
        <td className="px-4 py-2 text-xs text-muted">
          {e.field && <span className={`mr-1 rounded px-1.5 py-0.5 font-medium ${fieldBadgeClass(e.field)}`}>{e.field}</span>}
          {e.reason ? renderHighlightedReason(e.reason) : truncate(e.newValue)}
        </td>
        <td className="px-2 py-2 text-end">
          <button onClick={() => toggleHidden(e)} className="text-xs text-accent hover:underline">
            {e.hiddenAt ? t('unhide') : t('hide')}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          {t('showHidden')}
        </label>
        {dayGroups.length > 0 && (
          <DayGroupToggleAll
            allExpanded={allExpanded}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            expandLabel={tc('expandAll')}
            collapseLabel={tc('collapseAll')}
          />
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.time')}</th>
              <th className="px-4 py-2 text-start">{t('columns.entity')}</th>
              <th className="px-4 py-2 text-start">{t('columns.action')}</th>
              <th className="px-4 py-2 text-start">{t('columns.actor')}</th>
              <th className="px-4 py-2 text-start">{t('columns.detail')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-sm text-muted">
                  {tc('empty')}
                </td>
              </tr>
            )}
            {dayGroups.map((group, idx) => (
              <Fragment key={group.key}>
                <DayGroupRow
                  label={dayGroupLabel(group.date, locale, tc('today'), tc('yesterday'))}
                  count={group.rows.length}
                  colSpan={6}
                  expanded={isExpanded(idx)}
                  onToggle={() => toggle(idx)}
                />
                {isExpanded(idx) && group.rows.map((e) => renderRow(e))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
