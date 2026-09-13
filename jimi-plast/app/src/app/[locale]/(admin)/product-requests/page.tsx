'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface RequestRow {
  id: string;
  productName: string;
  quantityWanted: number | null;
  status: string;
  customer: { user: { fullName: string } };
}

const STATUSES = ['NEW', 'SEARCHING', 'FOUND', 'ORDERED', 'AVAILABLE', 'REFUSED'];

export default function ProductRequestsPage() {
  const t = useTranslations('productRequests');
  const { token } = useAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);

  function reload() {
    api.get<RequestRow[]>('/product-requests', token).then(setRequests);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function updateStatus(id: string, status: string) {
    await api.put(`/product-requests/${id}/status`, { status }, token);
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.product')}</th>
              <th className="px-4 py-2 text-start">{t('columns.customer')}</th>
              <th className="px-4 py-2 text-start">{t('columns.quantity')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium text-ink">{r.productName}</td>
                <td className="px-4 py-2 text-muted">{r.customer.user.fullName}</td>
                <td className="px-4 py-2 tabular">{r.quantityWanted ?? '—'}</td>
                <td className="px-4 py-2">
                  <select
                    value={r.status}
                    onChange={(e) => updateStatus(r.id, e.target.value)}
                    className="rounded border border-line bg-paper px-2 py-1 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`status.${s}` as never)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
