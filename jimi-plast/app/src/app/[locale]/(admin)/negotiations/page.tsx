'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface NegotiationRow {
  id: string;
  currentPrice: string;
  requestedPrice: string;
  requestedQuantity: number;
  status: string;
  customer: { user: { fullName: string } };
  product: { nameFr: string };
}

export default function NegotiationsPage() {
  const t = useTranslations('negotiations');
  const { token } = useAuth();
  const [negotiations, setNegotiations] = useState<NegotiationRow[]>([]);
  const [counterPrice, setCounterPrice] = useState<Record<string, string>>({});

  function reload() {
    api.get<NegotiationRow[]>('/negotiations', token).then(setNegotiations);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function respond(id: string, status: string) {
    const price = counterPrice[id];
    await api.post(`/negotiations/${id}/respond`, {
      status,
      counterPrice: status === 'COUNTERED' && price ? Number(price) : undefined,
    }, token);
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.product')}</th>
              <th className="px-4 py-2 text-start">{t('columns.customer')}</th>
              <th className="px-4 py-2 text-start">{t('columns.current')}</th>
              <th className="px-4 py-2 text-start">{t('columns.requested')}</th>
              <th className="px-4 py-2 text-start">{t('columns.quantity')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {negotiations.map((n) => (
              <tr key={n.id} className="border-t border-line">
                <td className="px-4 py-2 text-ink">{n.product.nameFr}</td>
                <td className="px-4 py-2 text-muted">{n.customer.user.fullName}</td>
                <td className="px-4 py-2 tabular">{n.currentPrice} DA</td>
                <td className="px-4 py-2 tabular font-medium text-accent">{n.requestedPrice} DA</td>
                <td className="px-4 py-2 tabular">{n.requestedQuantity}</td>
                <td className="px-4 py-2 text-xs">{t(`status.${n.status}` as never)}</td>
                <td className="px-4 py-2 text-end">
                  {n.status === 'PENDING' && (
                    <div className="flex justify-end gap-1">
                      <input
                        type="number"
                        placeholder={t('counterPrice')}
                        value={counterPrice[n.id] ?? ''}
                        onChange={(e) => setCounterPrice({ ...counterPrice, [n.id]: e.target.value })}
                        className="w-24 rounded border border-line px-2 py-1 text-xs"
                      />
                      <button onClick={() => respond(n.id, 'ACCEPTED')} className="rounded bg-teal px-2 py-1 text-xs text-white">{t('accept')}</button>
                      <button onClick={() => respond(n.id, 'COUNTERED')} className="rounded bg-accent px-2 py-1 text-xs text-white">{t('counter')}</button>
                      <button onClick={() => respond(n.id, 'REJECTED')} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">{t('reject')}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
