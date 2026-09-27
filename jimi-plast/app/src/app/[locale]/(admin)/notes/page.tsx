'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { DayGroupToggleAll } from '@/components/day-group-row';
import { dayGroupLabel, groupByDay, useExpandedGroups } from '@/lib/date-groups';

interface NoteRow {
  id: string;
  text: string;
  createdAt: string;
  hiddenAt: string | null;
}

export default function NotesPage() {
  const t = useTranslations('notes');
  const tc = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();

  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [draft, setDraft] = useState('');

  function reload() {
    if (!token) return;
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (showHidden) params.set('includeHidden', 'true');
    const qs = params.toString();
    api.get<NoteRow[]>(`/notes${qs ? `?${qs}` : ''}`, token).then(setNotes);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, showHidden]);

  async function addNote() {
    if (!draft.trim()) return;
    await api.post('/notes', { text: draft.trim() }, token);
    setDraft('');
    reload();
  }

  async function toggleHidden(n: NoteRow) {
    await api.put(`/notes/${n.id}/hide`, { hidden: !n.hiddenAt }, token);
    reload();
  }

  const dayGroups = useMemo(() => groupByDay(notes, (n) => n.createdAt), [notes]);
  const { isExpanded, toggle, allExpanded, expandAll, collapseAll } = useExpandedGroups(dayGroups);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote();
          }}
          placeholder={t('placeholder')}
          rows={3}
          className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
        />
        <button
          onClick={addNote}
          disabled={!draft.trim()}
          className="self-start rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {t('add')}
        </button>
      </div>

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

      {notes.length === 0 ? (
        <p className="text-sm text-muted">{tc('empty')}</p>
      ) : (
        <div className="flex flex-col">
          {dayGroups.map((group, idx) => (
            <Fragment key={group.key}>
              <button
                onClick={() => toggle(idx)}
                className="flex items-center gap-2 border-t border-line py-2 text-start text-xs font-semibold text-ink first:border-t-0"
              >
                <span className={`inline-block transition-transform ${isExpanded(idx) ? 'rotate-90' : ''}`}>▶</span>
                <span>{dayGroupLabel(group.date, locale, tc('today'), tc('yesterday'))}</span>
                <span className="text-muted">({group.rows.length})</span>
              </button>
              {isExpanded(idx) && (
                <ul className="flex flex-col gap-2 pb-3 ps-6">
                  {group.rows.map((n) => (
                    <li
                      key={n.id}
                      className={`flex items-start justify-between gap-2 rounded-lg border border-line p-3 text-sm ${
                        n.hiddenAt ? 'bg-line/10 opacity-60' : 'bg-panel'
                      }`}
                    >
                      <span className="whitespace-pre-wrap text-ink">
                        <span className="font-mono text-xs text-muted">{new Date(n.createdAt).toLocaleTimeString(locale)}</span> — {n.text}
                      </span>
                      <button onClick={() => toggleHidden(n)} className="shrink-0 text-xs text-accent hover:underline">
                        {n.hiddenAt ? t('unhide') : t('hide')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
