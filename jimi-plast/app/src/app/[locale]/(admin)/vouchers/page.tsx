'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Customer {
  id: string;
  user: { fullName: string };
}
interface VoucherRow {
  id: string;
  number: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
  discount: string;
  transportCost: string;
  customer: { businessName: string | null; user: { fullName: string } };
  items: { lineTotal: string }[];
}

export default function VouchersPage() {
  const t = useTranslations('vouchers');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');

  function reload() {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (customerFilter) params.set('customerId', customerFilter);
    api.get<VoucherRow[]>(`/vouchers?${params.toString()}`, token).then(setVouchers);
  }

  useEffect(() => {
    if (token) api.get<Customer[]>('/customers', token).then(setCustomers);
  }, [token]);

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, customerFilter]);

  async function createVoucher() {
    if (!newCustomerId) return;
    const voucher = await api.post<{ id: string }>('/vouchers/draft', { customerId: newCustomerId }, token);
    router.push(`/${locale}/vouchers/${voucher.id}`);
  }

  const total = (v: VoucherRow) =>
    v.items.reduce((s, i) => s + Number(i.lineTotal), 0) - Number(v.discount) + Number(v.transportCost);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <div className="flex gap-2">
          <select
            value={newCustomerId}
            onChange={(e) => setNewCustomerId(e.target.value)}
            className="rounded border border-line bg-panel px-2 py-1.5 text-sm"
          >
            <option value="">{t('selectCustomer')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.user.fullName}
              </option>
            ))}
          </select>
          <button
            onClick={createVoucher}
            disabled={!newCustomerId}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('newVoucher')}
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-line bg-panel px-3 py-2 text-sm">
          <option value="">{t('filterStatus')}</option>
          {['DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}` as never)}
            </option>
          ))}
        </select>
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="rounded border border-line bg-panel px-3 py-2 text-sm">
          <option value="">{t('filterCustomer')}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.user.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.number')}</th>
              <th className="px-4 py-2 text-start">{t('columns.customer')}</th>
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
                <td className="px-4 py-2 font-mono text-xs">{v.number ?? '(brouillon)'}</td>
                <td className="px-4 py-2 text-ink">{v.customer.user.fullName}</td>
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
