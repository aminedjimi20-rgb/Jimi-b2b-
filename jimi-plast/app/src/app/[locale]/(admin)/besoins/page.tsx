'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface BesoinRow {
  id: string;
  message: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  author?: { fullName: string; role: { name: string; key: string } };
}

export default function BesoinsPage() {
  const t = useTranslations('besoins');
  const { token, hasPermission } = useAuth();
  const canManage = hasPermission('besoins.manage');

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [mine, setMine] = useState<BesoinRow[]>([]);
  const [all, setAll] = useState<BesoinRow[]>([]);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});

  function reload() {
    if (!token) return;
    api.get<BesoinRow[]>('/besoins/mine', token).then(setMine);
    if (canManage) api.get<BesoinRow[]>('/besoins', token).then(setAll);
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canManage]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post('/besoins', { message: message.trim() }, token);
      setMessage('');
      reload();
    } finally {
      setSending(false);
    }
  }

  async function respond(id: string) {
    const response = responseDrafts[id]?.trim();
    if (!response) return;
    await api.put(`/besoins/${id}/respond`, { response }, token);
    setResponseDrafts((d) => ({ ...d, [id]: '' }));
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="text-sm text-muted">{t('subtitle')}</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('placeholder')}
          rows={3}
          className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="self-start rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {t('send')}
        </button>
      </form>

      {canManage ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">{t('all')}</h2>
          {all.length === 0 && <p className="text-sm text-muted">{t('empty')}</p>}
          {all.map((b) => (
            <div key={b.id} className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{b.author?.fullName}</span>
                <span className="text-xs text-muted">{new Date(b.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-ink">{b.message}</p>
              {b.response ? (
                <div className="rounded border-s-2 border-accent bg-accent/5 px-3 py-2 text-sm text-ink">
                  <span className="text-xs font-semibold text-accent">{t('yourResponse')} — </span>
                  {b.response}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={responseDrafts[b.id] ?? ''}
                    onChange={(e) => setResponseDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                    placeholder={t('respondPlaceholder')}
                    className="flex-1 rounded border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => respond(b.id)}
                    disabled={!responseDrafts[b.id]?.trim()}
                    className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {t('respond')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">{t('mine')}</h2>
          {mine.length === 0 && <p className="text-sm text-muted">{t('empty')}</p>}
          {mine.map((b) => (
            <div key={b.id} className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{new Date(b.createdAt).toLocaleString()}</span>
                <span className={`text-xs font-medium ${b.response ? 'text-accent' : 'text-muted'}`}>
                  {b.response ? t('responded') : t('pending')}
                </span>
              </div>
              <p className="text-sm text-ink">{b.message}</p>
              {b.response && (
                <div className="rounded border-s-2 border-accent bg-accent/5 px-3 py-2 text-sm text-ink">
                  {b.response}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
