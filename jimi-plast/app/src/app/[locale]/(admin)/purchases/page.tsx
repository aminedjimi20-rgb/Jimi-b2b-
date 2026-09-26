'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SortSelect, type SortMode } from '@/components/sort-select';
import { DayGroupRow, DayGroupToggleAll } from '@/components/day-group-row';
import { dayGroupLabel, groupByDay, useExpandedGroups } from '@/lib/date-groups';

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
  items: { lineTotal: string; totalUnits: number }[];
  pendingDeletions: { status: 'PENDING' | 'APPROVED' | 'REJECTED' }[];
}

const total = (p: PurchaseRow) => p.items.reduce((s, i) => s + Number(i.lineTotal), 0) - Number(p.discount) + Number(p.transportCost);

export default function PurchasesPage() {
  const t = useTranslations('purchases');
  const tVoucher = useTranslations('vouchers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  function reload() {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (manufacturerFilter) params.set('manufacturerId', manufacturerFilter);
    api.get<PurchaseRow[]>(`/purchase-vouchers?${params.toString()}`, token).then(setPurchases);
  }

  useEffect(() => {
    if (token) api.get<Manufacturer[]>('/manufacturers', token).then(setManufacturers);
  }, [token]);

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, manufacturerFilter]);

  async function createPurchase() {
    if (!selectedManufacturer) return;
    const voucher = await api.post<{ id: string }>('/purchase-vouchers/draft', { manufacturerId: selectedManufacturer }, token);
    router.push(`/${locale}/purchases/${voucher.id}`);
  }

  const totalQty = (p: PurchaseRow) => p.items.reduce((s, i) => s + i.totalUnits, 0);

  const sortedPurchases = useMemo(() => {
    const arr = [...purchases];
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
        arr.sort((a, b) => a.manufacturer.name.localeCompare(b.manufacturer.name));
        break;
      case 'name_desc':
        arr.sort((a, b) => b.manufacturer.name.localeCompare(a.manufacturer.name));
        break;
      case 'newest':
      default:
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchases, sortMode]);

  const groupByDate = sortMode === 'newest' || sortMode === 'oldest';
  const dayGroups = useMemo(
    () => (groupByDate ? groupByDay(sortedPurchases, (p) => p.createdAt) : []),
    [sortedPurchases, groupByDate],
  );
  const { isExpanded, toggle, allExpanded, expandAll, collapseAll } = useExpandedGroups(dayGroups);

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-col gap-3 bg-paper pb-3">
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

        <div className="flex flex-wrap gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-line bg-panel px-3 py-2 text-sm">
            <option value="">{t('filterStatus')}</option>
            {['DRAFT', 'CONFIRMED', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>
                {tVoucher(`status.${s}` as never)}
              </option>
            ))}
          </select>
          <select value={manufacturerFilter} onChange={(e) => setManufacturerFilter(e.target.value)} className="rounded border border-line bg-panel px-3 py-2 text-sm">
            <option value="">{t('filterManufacturer')}</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <SortSelect
            value={sortMode}
            onChange={setSortMode}
            options={['newest', 'oldest', 'price_desc', 'price_asc', 'qty_desc', 'qty_asc', 'name_asc', 'name_desc']}
          />
          {groupByDate && dayGroups.length > 0 && (
            <DayGroupToggleAll
              allExpanded={allExpanded}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              expandLabel={tCommon('expandAll')}
              collapseLabel={tCommon('collapseAll')}
            />
          )}
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
            {groupByDate
              ? dayGroups.map((group, idx) => (
                  <Fragment key={group.key}>
                    <DayGroupRow
                      label={dayGroupLabel(group.date, locale, tCommon('today'), tCommon('yesterday'))}
                      count={group.rows.length}
                      colSpan={5}
                      expanded={isExpanded(idx)}
                      onToggle={() => toggle(idx)}
                    />
                    {isExpanded(idx) &&
                      group.rows.map((p) => (
                        <PurchaseTableRow key={p.id} p={p} tVoucher={tVoucher} locale={locale} router={router} />
                      ))}
                  </Fragment>
                ))
              : sortedPurchases.map((p) => (
                  <PurchaseTableRow key={p.id} p={p} tVoucher={tVoucher} locale={locale} router={router} />
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseTableRow({
  p,
  tVoucher,
  locale,
  router,
}: {
  p: PurchaseRow;
  tVoucher: (key: string) => string;
  locale: string;
  router: ReturnType<typeof useRouter>;
}) {
  const deletion = p.pendingDeletions[0];
  const struckThrough = deletion?.status === 'PENDING' || deletion?.status === 'APPROVED';
  return (
    <tr
      onClick={() => router.push(`/${locale}/purchases/${p.id}`)}
      className={`cursor-pointer border-t border-line hover:bg-line/20 ${struckThrough ? 'line-through opacity-60' : ''}`}
    >
      <td className="px-4 py-2 font-mono text-xs">{p.number ?? '(brouillon)'}</td>
      <td className="px-4 py-2 text-ink">{p.manufacturer.name}</td>
      <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
      <td className="px-4 py-2 tabular">{total(p).toLocaleString()} DA</td>
      <td className="px-4 py-2 text-xs">{tVoucher(`status.${p.status}` as never)}</td>
    </tr>
  );
}
