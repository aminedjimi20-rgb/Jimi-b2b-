'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SortSelect, type SortMode } from '@/components/sort-select';
import { DayGroupRow } from '@/components/day-group-row';
import { dayGroupLabel, groupByDay, useExpandedGroups } from '@/lib/date-groups';

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
  depot: string | null;
  customer: { businessName: string | null; user: { fullName: string } };
  items: { lineTotal: string; totalUnits: number }[];
  pendingDeletions: { status: 'PENDING' | 'APPROVED' | 'REJECTED'; reason: string }[];
}

const DEFAULT_DEPOTS = ['Dépôt 1', 'Dépôt 2', 'Dépôt 3'];

const total = (v: VoucherRow) =>
  v.items.reduce((s, i) => s + Number(i.lineTotal), 0) - Number(v.discount) + Number(v.transportCost);

export default function VouchersPage() {
  const t = useTranslations('vouchers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [depotFilter, setDepotFilter] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  function reload() {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (customerFilter) params.set('customerId', customerFilter);
    if (depotFilter) params.set('depot', depotFilter);
    api.get<VoucherRow[]>(`/vouchers?${params.toString()}`, token).then(setVouchers);
  }

  useEffect(() => {
    if (token) api.get<Customer[]>('/customers', token).then(setCustomers);
  }, [token]);

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, customerFilter, depotFilter]);

  async function createVoucher() {
    if (!newCustomerId) return;
    const voucher = await api.post<{ id: string }>('/vouchers/draft', { customerId: newCustomerId }, token);
    router.push(`/${locale}/vouchers/${voucher.id}`);
  }

  const totalQty = (v: VoucherRow) => v.items.reduce((s, i) => s + i.totalUnits, 0);

  const sortedVouchers = useMemo(() => {
    const arr = [...vouchers];
    switch (sortMode) {
      case 'oldest':
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'price_desc':
        arr.sort((a, b) => total(b) - total(a));
        break;
      case 'price_asc':
        arr.sort((a, b) => total(a) - total(b));
        break;
      case 'qty_desc':
        arr.sort((a, b) => totalQty(b) - totalQty(a));
        break;
      case 'qty_asc':
        arr.sort((a, b) => totalQty(a) - totalQty(b));
        break;
      case 'name_asc':
        arr.sort((a, b) => a.customer.user.fullName.localeCompare(b.customer.user.fullName));
        break;
      case 'name_desc':
        arr.sort((a, b) => b.customer.user.fullName.localeCompare(a.customer.user.fullName));
        break;
      case 'newest':
      default:
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vouchers, sortMode]);

  const depotOptions = useMemo(() => {
    const used = vouchers.map((v) => v.depot).filter((d): d is string => Boolean(d));
    return Array.from(new Set([...DEFAULT_DEPOTS, ...used]));
  }, [vouchers]);

  const groupByDate = sortMode === 'newest' || sortMode === 'oldest';
  const dayGroups = useMemo(
    () => (groupByDate ? groupByDay(sortedVouchers, (v) => v.createdAt) : []),
    [sortedVouchers, groupByDate],
  );
  const { isExpanded, toggle } = useExpandedGroups(dayGroups);

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-col gap-3 bg-paper pb-3">
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
        <select value={depotFilter} onChange={(e) => setDepotFilter(e.target.value)} className="rounded border border-line bg-panel px-3 py-2 text-sm">
          <option value="">{t('allDepots')}</option>
          {depotOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <SortSelect
          value={sortMode}
          onChange={setSortMode}
          options={['newest', 'oldest', 'price_desc', 'price_asc', 'qty_desc', 'qty_asc', 'name_asc', 'name_desc']}
        />
      </div>
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
              <th className="px-4 py-2 text-start">{t('columns.depot')}</th>
            </tr>
          </thead>
          <tbody>
            {groupByDate
              ? dayGroups.map((group, idx) => (
                  <Fragment key={group.key}>
                    <DayGroupRow
                      label={dayGroupLabel(group.date, locale, tCommon('today'), tCommon('yesterday'))}
                      count={group.rows.length}
                      colSpan={6}
                      expanded={isExpanded(idx)}
                      onToggle={() => toggle(idx)}
                    />
                    {isExpanded(idx) && group.rows.map((v) => <VoucherTableRow key={v.id} v={v} t={t} locale={locale} router={router} />)}
                  </Fragment>
                ))
              : sortedVouchers.map((v) => <VoucherTableRow key={v.id} v={v} t={t} locale={locale} router={router} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VoucherTableRow({
  v,
  t,
  locale,
  router,
}: {
  v: VoucherRow;
  t: (key: string) => string;
  locale: string;
  router: ReturnType<typeof useRouter>;
}) {
  const deletion = v.pendingDeletions[0];
  const struckThrough = deletion?.status === 'PENDING' || deletion?.status === 'APPROVED';
  return (
    <tr
      onClick={() => router.push(`/${locale}/vouchers/${v.id}`)}
      className={`cursor-pointer border-t border-line hover:bg-line/20 ${struckThrough ? 'line-through opacity-60' : ''}`}
    >
      <td className="px-4 py-2 font-mono text-xs">{v.number ?? '(brouillon)'}</td>
      <td className="px-4 py-2 text-ink">{v.customer.user.fullName}</td>
      <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(v.createdAt).toLocaleDateString()}</td>
      <td className="px-4 py-2 tabular">{total(v).toLocaleString()} DA</td>
      <td className="px-4 py-2">
        <StatusPill status={v.status} label={t(`status.${v.status}` as never)} />
      </td>
      <td className="px-4 py-2 text-xs text-muted">{v.depot ?? '—'}</td>
    </tr>
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
