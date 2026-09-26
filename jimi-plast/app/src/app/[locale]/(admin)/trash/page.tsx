'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface TrashRow {
  id: string;
  entityType: string;
  entityId: string;
  snapshot: Record<string, unknown>;
  deletedByName: string | null;
  deletedAt: string;
}

function labelForSnapshot(snapshot: Record<string, unknown>): string {
  return (
    (snapshot.title as string) ||
    (snapshot.nameFr as string) ||
    (snapshot.name as string) ||
    (snapshot.fullName as string) ||
    (snapshot.sku as string) ||
    ''
  );
}

export default function TrashPage() {
  const t = useTranslations('trash');
  const { token, hasPermission } = useAuth();
  const [items, setItems] = useState<TrashRow[]>([]);

  function reload() {
    if (!token) return;
    api.get<TrashRow[]>('/trash', token).then(setItems);
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function restore(id: string) {
    await api.post(`/trash/${id}/restore`, undefined, token);
    reload();
  }

  async function purge(id: string) {
    if (!confirm(t('purgeConfirm'))) return;
    await api.post(`/trash/${id}/purge`, undefined, token);
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

      {items.length === 0 ? (
        <p className="text-sm text-muted">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-line/30 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-start">{t('columns.type')}</th>
                <th className="px-4 py-2 text-start" />
                <th className="px-4 py-2 text-start">{t('columns.deletedBy')}</th>
                <th className="px-4 py-2 text-start">{t('columns.deletedAt')}</th>
                <th className="px-4 py-2 text-end">{t('restore')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-2 text-ink">{t(`entityTypes.${item.entityType}` as never)}</td>
                  <td className="px-4 py-2 text-muted">{labelForSnapshot(item.snapshot)}</td>
                  <td className="px-4 py-2 text-muted">{item.deletedByName ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-muted">{new Date(item.deletedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-end">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => restore(item.id)} className="text-xs text-accent hover:underline">
                        {t('restore')}
                      </button>
                      {hasPermission('trash.purge') && (
                        <button onClick={() => purge(item.id)} className="text-xs text-red-600 hover:underline">
                          {t('purge')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
