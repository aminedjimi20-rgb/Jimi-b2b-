'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface VoucherRow {
  id: string;
  number: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
  discount: string;
  transportCost: string;
  items: { lineTotal: string }[];
}

export default function MyOrdersPage() {
  const t = useTranslations('vouchers');
  const tNav = useTranslations('nav');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);

  useEffect(() => {
    if (token) api.get<VoucherRow[]>('/vouchers/mine', token).then(setVouchers);
  }, [token]);

  const total = (v: VoucherRow) =>
    v.items.reduce((s, i) => s + Number(i.lineTotal), 0) - Number(v.discount) + Number(v.transportCost);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{tNav('myOrders')}</h1>

      {vouchers.length === 0 ? (
        <p className="text-sm text-muted">{t('noOrders' as never)}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-line/30 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-start">{t('columns.number')}</th>
                <th className="px-4 py-2 text-start">{t('columns.date')}</th>
                <th className="px-4 py-2 text-start">{t('columns.total')}</th>
                <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => router.push(`/${locale}/vouchers/${v.id}`)}
                  className="cursor-pointer border-t border-line hover:bg-line/20"
                >
                  <td className="px-4 py-2 font-mono text-xs">{v.number ?? t('status.DRAFT')}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(v.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 tabular">{total(v).toLocaleString()} DA</td>
                  <td className="px-4 py-2">
                    <StatusPill status={v.status} label={t(`status.${v.status}` as never)} />
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

function StatusPill({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-line/40 text-muted',
    CONFIRMED: 'bg-accent/15 text-accent',
    DELIVERED: 'bg-teal/15 text-teal',
    CANCELLED: 'bg-red-100 text-red-600',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${colors[status] ?? ''}`}>{label}</span>;
}
