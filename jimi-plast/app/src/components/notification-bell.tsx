'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  data: { pendingDeletionId?: string } | null;
}

export function NotificationBell() {
  const t = useTranslations('notifications');
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  function reload() {
    if (!token) return;
    api.get<Notification[]>('/notifications/mine', token).then(setNotifications);
    api.get<{ count: number }>('/notifications/mine/unread-count', token).then((r) => setUnread(r.count));
  }

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function markAllRead() {
    await api.put('/notifications/read-all', undefined, token);
    reload();
  }

  async function remove(id: string) {
    await api.delete(`/notifications/${id}`, token);
    reload();
  }

  async function respond(pendingDeletionId: string, decision: 'APPROVED' | 'REJECTED') {
    if (decision === 'APPROVED' && !window.confirm(t('confirmApprove'))) return;
    await api.post(`/pending-deletions/${pendingDeletionId}/respond`, { decision }, token);
    reload();
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative rounded p-1.5 text-ink hover:bg-line/30">
        🔔
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        // Sur mobile, une fenêtre ancrée au clocher (dropdown classique)
        // déborde facilement de l'écran ou se fait couper par le défilement
        // horizontal du bandeau — on la centre plutôt comme les autres
        // fenêtres modales de l'appli ; à partir de sm:, on revient au
        // dropdown ancré, plus adapté à un écran large.
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:absolute sm:inset-auto sm:end-0 sm:top-full sm:z-10 sm:mt-2 sm:block sm:bg-transparent sm:p-0"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-lg border border-line bg-panel shadow-lg sm:w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-sm font-semibold text-ink">{t('title')}</span>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-accent hover:underline">
                    {t('markAllRead')}
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t('close')}
                  className="text-muted hover:text-ink sm:hidden"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 && <p className="p-4 text-center text-sm text-muted">{t('empty')}</p>}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`group flex items-start justify-between gap-2 border-b border-line px-3 py-2 last:border-b-0 ${!n.readAt ? 'bg-accent/5' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    <p className="text-xs text-muted">{n.body}</p>
                    <p className="mt-0.5 text-[10px] text-muted">{new Date(n.createdAt).toLocaleString()}</p>
                    {n.type === 'pending_deletion.requested' && n.data?.pendingDeletionId && (
                      <div className="mt-1.5 flex gap-2">
                        <button
                          onClick={() => respond(n.data!.pendingDeletionId!, 'APPROVED')}
                          className="rounded bg-teal px-2 py-1 text-[11px] font-medium text-white"
                        >
                          {t('approve')}
                        </button>
                        <button
                          onClick={() => respond(n.data!.pendingDeletionId!, 'REJECTED')}
                          className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                        >
                          {t('reject')}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => remove(n.id)}
                    title={t('delete')}
                    aria-label={t('delete')}
                    className="shrink-0 rounded p-1 text-muted opacity-60 hover:bg-line/40 hover:text-red-600 hover:opacity-100"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
