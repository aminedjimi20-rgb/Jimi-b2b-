'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { SortSelect, type SortMode } from '@/components/sort-select';

interface Customer {
  id: string;
  user: { fullName: string };
}
interface Manufacturer {
  id: string;
  name: string;
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
  const [decisionByReturn, setDecisionByReturn] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function openForm() {
    setShowForm(true);
    setType('CUSTOMER');
    setPartyId('');
  }

  // Le retour est créé dès que le type et le client/fabricant sont choisis —
  // sans article, comme un bon ou un achat en brouillon (§ pattern établi).
  // On redirige ensuite vers sa fiche, où les articles s'ajoutent un par un
  // et où le retour reste visible/reprenable si on quitte avant de valider.
  async function createDraft() {
    if (!partyId) return;
    setCreating(true);
    setError(null);
    try {
      const ret = await api.post<{ id: string }>('/returns', {
        type,
        customerId: type === 'CUSTOMER' ? partyId : undefined,
        manufacturerId: type === 'SUPPLIER' ? partyId : undefined,
        items: [],
      }, token);
      router.push(`/${locale}/returns/${ret.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tCommon('error'));
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
      <div className="sticky top-0 z-10 flex flex-col gap-3 bg-paper pb-3">
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
              <button
                onClick={createDraft}
                disabled={!partyId || creating}
                className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t('createReturn')}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>

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
                <td className="px-4 py-2 font-mono text-xs">{r.number ?? '(brouillon)'}</td>
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
    </div>
  );
}
