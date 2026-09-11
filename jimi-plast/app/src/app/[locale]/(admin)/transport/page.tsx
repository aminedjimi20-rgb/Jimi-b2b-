'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface DeliveryRow {
  id: string;
  voucherId: string;
  driverName: string | null;
  status: string;
  cost: string;
  voucher: { number: string | null; customer: { user: { fullName: string } } };
}

const STATUSES = ['TO_PREPARE', 'PREPARED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED', 'PROBLEM'];

export default function TransportPage() {
  const t = useTranslations('transport');
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);

  function reload() {
    api.get<DeliveryRow[]>('/deliveries', token).then(setDeliveries);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function updateStatus(voucherId: string, status: string) {
    await api.put(`/deliveries/voucher/${voucherId}`, { status }, token);
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.voucher')}</th>
              <th className="px-4 py-2 text-start">{t('columns.customer')}</th>
              <th className="px-4 py-2 text-start">{t('columns.driver')}</th>
              <th className="px-4 py-2 text-start">{t('columns.cost')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} className="border-t border-line">
                <td className="px-4 py-2 font-mono text-xs">{d.voucher.number}</td>
                <td className="px-4 py-2 text-ink">{d.voucher.customer.user.fullName}</td>
                <td className="px-4 py-2 text-muted">{d.driverName ?? '—'}</td>
                <td className="px-4 py-2 tabular">{Number(d.cost).toLocaleString()} DA</td>
                <td className="px-4 py-2">
                  <select
                    value={d.status}
                    onChange={(e) => updateStatus(d.voucherId, e.target.value)}
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
