'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Manufacturer {
  id: string;
  name: string;
}
interface PurchaseRow {
  id: string;
  number: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  discount: string;
  transportCost: string;
  manufacturer: { name: string };
  items: { lineTotal: string }[];
}

export default function PurchasesPage() {
  const t = useTranslations('purchases');
  const tVoucher = useTranslations('vouchers');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState('');

  function reload() {
    api.get<PurchaseRow[]>('/purchase-vouchers', token).then(setPurchases);
  }
  useEffect(() => {
    if (token) {
      reload();
      api.get<Manufacturer[]>('/manufacturers', token).then(setManufacturers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createPurchase() {
    if (!selectedManufacturer) return;
    const voucher = await api.post<{ id: string }>('/purchase-vouchers/draft', { manufacturerId: selectedManufacturer }, token);
    router.push(`/${locale}/purchases/${voucher.id}`);
  }

  const total = (p: PurchaseRow) => p.items.reduce((s, i) => s + Number(i.lineTotal), 0) - Number(p.discount) + Number(p.transportCost);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <div className="flex gap-2">
          <select value={selectedManufacturer} onChange={(e) => setSelectedManufacturer(e.target.value)} className="rounded border border-line bg-panel px-2 py-1.5 text-sm">
            <option value="">{t('selectManufacturer')}</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button onClick={createPurchase} disabled={!selectedManufacturer} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {t('newPurchase')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.number')}</th>
              <th className="px-4 py-2 text-start">{t('columns.manufacturer')}</th>
              <th className="px-4 py-2 text-start">{t('columns.date')}</th>
              <th className="px-4 py-2 text-start">{t('columns.total')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} onClick={() => router.push(`/${locale}/purchases/${p.id}`)} className="cursor-pointer border-t border-line hover:bg-line/20">
                <td className="px-4 py-2 font-mono text-xs">{p.number ?? '(brouillon)'}</td>
                <td className="px-4 py-2 text-ink">{p.manufacturer.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 tabular">{total(p).toLocaleString()} DA</td>
                <td className="px-4 py-2 text-xs">{tVoucher(`status.${p.status}` as never)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
