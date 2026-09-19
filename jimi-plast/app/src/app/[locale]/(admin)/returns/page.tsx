'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SortSelect, type SortMode } from '@/components/sort-select';

interface Customer {
  id: string;
  user: { fullName: string };
}
interface Manufacturer {
  id: string;
  name: string;
}
interface PickerProduct {
  id: string;
  sku: string;
  nameFr: string;
  costPrice: number | null;
  images: { url: string }[];
}
interface ReturnRow {
  id: string;
  number: string | null;
  type: 'CUSTOMER' | 'SUPPLIER';
  status: 'NEW' | 'VALIDATED' | 'REJECTED';
  totalValue: string;
  createdAt: string;
  updatedAt: string;
  customer?: { user: { fullName: string } };
  manufacturer?: { name: string };
  items: { product: { nameFr: string }; quantity: number; reason: string }[];
}
interface DraftItem {
  productId: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  reason: string;
  condition: 'DAMAGED' | 'DEFECTIVE' | 'OTHER';
  unitPrice: string;
}

const CONDITIONS: DraftItem['condition'][] = ['DAMAGED', 'DEFECTIVE', 'OTHER'];

export default function ReturnsPage() {
  const t = useTranslations('returns');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [tab, setTab] = useState<'all' | 'CUSTOMER' | 'SUPPLIER'>('all');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [partyId, setPartyId] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [decisionByReturn, setDecisionByReturn] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<PickerProduct[]>([]);
  const [addingProduct, setAddingProduct] = useState<PickerProduct | null>(null);
  const [modalQty, setModalQty] = useState('1');
  const [modalReason, setModalReason] = useState('');
  const [modalCondition, setModalCondition] = useState<DraftItem['condition']>('DAMAGED');
  const [modalUnitPrice, setModalUnitPrice] = useState('');

  function reload() {
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('type', tab);
    api.get<ReturnRow[]>(`/returns?${params.toString()}`, token).then(setReturns);
  }

  useEffect(() => {
    if (token) {
      api.get<Customer[]>('/customers', token).then(setCustomers);
      api.get<Manufacturer[]>('/manufacturers', token).then(setManufacturers);
    }
  }, [token]);

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab]);

  useEffect(() => {
    if (!token || !showPicker || !partyId) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (pickerQuery) params.set('search', pickerQuery);
      if (type === 'SUPPLIER') params.set('manufacturerId', partyId);
      params.set('pageSize', '100');
      api.get<{ items: PickerProduct[] }>(`/products?${params.toString()}`, token).then((res) => setPickerResults(res.items));
    }, 250);
    return () => clearTimeout(timeout);
  }, [token, showPicker, pickerQuery, type, partyId]);

  function openForm() {
    setShowForm(true);
    setType('CUSTOMER');
    setPartyId('');
    setItems([]);
    setShowPicker(false);
    setPickerQuery('');
  }

  function openAddModal(p: PickerProduct) {
    setAddingProduct(p);
    setModalQty('1');
    setModalReason('');
    setModalCondition('DAMAGED');
    setModalUnitPrice(type === 'SUPPLIER' && p.costPrice != null ? String(p.costPrice) : '');
  }

  function confirmAddItem() {
    if (!addingProduct || !modalReason.trim() || Number(modalQty) < 1) return;
    setItems((prev) => [
      ...prev,
      {
        productId: addingProduct.id,
        productName: addingProduct.nameFr,
        productImage: addingProduct.images[0]?.url ?? null,
        quantity: Number(modalQty),
        reason: modalReason.trim(),
        condition: modalCondition,
        unitPrice: modalUnitPrice,
      },
    ]);
    setAddingProduct(null);
    setShowPicker(false);
    setPickerQuery('');
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!partyId || items.length === 0) return;
    setCreating(true);
    try {
      const ret = await api.post<{ id: string }>('/returns', {
        type,
        customerId: type === 'CUSTOMER' ? partyId : undefined,
        manufacturerId: type === 'SUPPLIER' ? partyId : undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          reason: i.reason,
          condition: i.condition,
          unitPrice: i.unitPrice.trim() === '' ? undefined : Number(i.unitPrice),
        })),
      }, token);
      router.push(`/${locale}/returns/${ret.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function validate(id: string) {
    const decision = decisionByReturn[id];
    if (!decision) return;
    await api.post(`/returns/${id}/validate`, { decision }, token);
    reload();
  }

  async function reject(id: string) {
    await api.post(`/returns/${id}/reject`, undefined, token);
    reload();
  }

  const partyName = (r: ReturnRow) => r.customer?.user.fullName ?? r.manufacturer?.name ?? '';

  const filteredReturns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return returns;
    return returns.filter((r) => {
      const haystack = [r.number ?? '', partyName(r), ...r.items.map((i) => i.product.nameFr)].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [returns, search]);

  const sortedReturns = useMemo(() => {
    const arr = [...filteredReturns];
    switch (sortMode) {
      case 'oldest':
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'modified_desc':
        arr.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'modified_asc':
        arr.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        break;
      case 'price_desc':
        arr.sort((a, b) => Number(b.totalValue) - Number(a.totalValue));
        break;
      case 'price_asc':
        arr.sort((a, b) => Number(a.totalValue) - Number(b.totalValue));
        break;
      case 'name_asc':
        arr.sort((a, b) => partyName(a).localeCompare(partyName(b)));
        break;
      case 'name_desc':
        arr.sort((a, b) => partyName(b).localeCompare(partyName(a)));
        break;
      case 'newest':
      default:
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return arr;
  }, [filteredReturns, sortMode]);

  const parties = type === 'CUSTOMER' ? customers : manufacturers;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <button onClick={() => (showForm ? setShowForm(false) : openForm())} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
          {t('new')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded border border-line text-sm">
          {(['all', 'CUSTOMER', 'SUPPLIER'] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`px-3 py-1.5 ${tab === tb ? 'bg-accent text-white' : 'bg-panel text-ink hover:bg-line/30'}`}
            >
              {tb === 'all' ? t('tabs.all') : tb === 'CUSTOMER' ? t('tabs.customers') : t('tabs.suppliers')}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="w-full max-w-xs rounded border border-line bg-panel px-3 py-1.5 text-sm"
        />
        <SortSelect
          value={sortMode}
          onChange={setSortMode}
          options={['newest', 'oldest', 'modified_desc', 'modified_asc', 'price_desc', 'price_asc', 'name_asc', 'name_desc']}
        />
      </div>

      {showForm && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as never);
                setPartyId('');
                setItems([]);
              }}
              className="rounded border border-line bg-paper text-ink px-3 py-2 text-sm"
            >
              <option value="CUSTOMER">{t('typeCustomer')}</option>
              <option value="SUPPLIER">{t('typeSupplier')}</option>
            </select>
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="rounded border border-line bg-paper text-ink px-3 py-2 text-sm">
              <option value="">{t('selectParty')}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {'user' in p ? p.user.fullName : p.name}
                </option>
              ))}
            </select>
          </div>

          {partyId && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink"
              >
                {t('pickProduct')}
              </button>
              {type === 'SUPPLIER' && <p className="mt-1 text-xs text-muted">{t('supplierProductHint')}</p>}
              {showPicker && (
                <div className="mt-2 rounded border border-line bg-panel p-2">
                  <input
                    type="search"
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder={tCommon('search')}
                    className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
                  />
                  <div className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                    {pickerResults.slice(0, 24).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openAddModal(p)}
                        className="flex flex-col items-center gap-1 rounded border border-line bg-paper p-2 text-center hover:border-accent"
                      >
                        <span className="h-12 w-12 overflow-hidden rounded border border-line bg-panel">
                          {p.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span className="line-clamp-2 text-[10px] text-ink">{p.nameFr}</span>
                      </button>
                    ))}
                    {pickerResults.length === 0 && <p className="col-span-full py-2 text-center text-xs text-muted">{tCommon('empty')}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {items.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {items.map((i, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 rounded border border-line bg-paper px-3 py-1.5">
                  <span className="flex items-center gap-2 text-ink">
                    {i.productImage ? (
                      <span className="h-8 w-8 shrink-0 overflow-hidden rounded border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.productImage} alt="" className="h-full w-full object-cover" />
                      </span>
                    ) : null}
                    <span>
                      {i.productName} — {i.quantity} pcs — {t(`conditions.${i.condition}` as never)} — {i.reason}
                      {i.unitPrice && ` — ${i.unitPrice} DA`}
                    </span>
                  </span>
                  <button onClick={() => removeItem(idx)} className="shrink-0 text-xs text-red-600">
                    {t('removeItem')}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{t('noItems')}</p>
          )}

          <button
            onClick={submit}
            disabled={!partyId || items.length === 0 || creating}
            className="mt-3 rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('createReturn')}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.number')}</th>
              <th className="px-4 py-2 text-start">{t('columns.party')}</th>
              <th className="px-4 py-2 text-start">{t('columns.date')}</th>
              <th className="px-4 py-2 text-start">{t('columns.value')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedReturns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-sm text-muted">
                  {tCommon('empty')}
                </td>
              </tr>
            )}
            {sortedReturns.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/${locale}/returns/${r.id}`)}
                className="cursor-pointer border-t border-line hover:bg-line/20"
              >
                <td className="px-4 py-2 font-mono text-xs">{r.number ?? '—'}</td>
                <td className="px-4 py-2 text-ink">{partyName(r)}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 tabular">{Number(r.totalValue).toLocaleString()} DA</td>
                <td className="px-4 py-2 text-xs text-ink">{t(`status.${r.status}` as never)}</td>
                <td className="px-4 py-2 text-end" onClick={(e) => e.stopPropagation()}>
                  {r.status === 'NEW' && (
                    <div className="flex justify-end gap-1">
                      <select
                        value={decisionByReturn[r.id] ?? ''}
                        onChange={(e) => setDecisionByReturn({ ...decisionByReturn, [r.id]: e.target.value })}
                        className="rounded border border-line bg-paper text-ink px-2 py-1 text-xs"
                      >
                        <option value="">{t('decision')}</option>
                        <option value="REFUND">{t('decisions.REFUND')}</option>
                        <option value="CREDIT_NOTE">{t('decisions.CREDIT_NOTE')}</option>
                        <option value="DEDUCT_NEXT">{t('decisions.DEDUCT_NEXT')}</option>
                        <option value="REPLACEMENT">{t('decisions.REPLACEMENT')}</option>
                      </select>
                      <button onClick={() => validate(r.id)} className="rounded bg-teal px-2 py-1 text-xs text-white">{t('validate')}</button>
                      <button onClick={() => reject(r.id)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">{t('reject')}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddingProduct(null)}>
          <div className="w-full max-w-sm rounded-lg bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-semibold text-ink">{addingProduct.nameFr}</p>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted">
                {t('quantity')}
                <input
                  type="number"
                  min={1}
                  value={modalQty}
                  onChange={(e) => setModalQty(e.target.value)}
                  className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-muted">
                {t('condition')}
                <select
                  value={modalCondition}
                  onChange={(e) => setModalCondition(e.target.value as never)}
                  className="mt-1 w-full rounded border border-line bg-paper text-ink px-3 py-2 text-sm"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`conditions.${c}` as never)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                {t('reason')}
                <input
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-muted">
                {t('unitPrice')}
                <input
                  type="number"
                  min={0}
                  value={modalUnitPrice}
                  onChange={(e) => setModalUnitPrice(e.target.value)}
                  placeholder={t('unitPriceHint')}
                  className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAddingProduct(null)} className="rounded border border-line px-3 py-2 text-sm text-ink">
                {tCommon('cancel')}
              </button>
              <button
                onClick={confirmAddItem}
                disabled={!modalReason.trim() || Number(modalQty) < 1}
                className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t('addItem')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
