'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';
import { SortSelect, type SortMode } from '@/components/sort-select';

interface PendingDeletion {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
}
interface Manufacturer {
  id: string;
  name: string;
  logoUrl: string | null;
  company: string | null;
  phone: string | null;
  wilaya: string | null;
  balance: number;
  createdAt: string;
  userId: string | null;
  pendingDeletions: PendingDeletion[];
  _count: { products: number };
}

const EMPTY = {
  name: '',
  logoUrl: '',
  company: '',
  phone: '',
  whatsapp: '',
  wilaya: '',
  contactName: '',
  paymentTerms: '',
};

export default function ManufacturersPage() {
  const t = useTranslations('manufacturers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Manufacturer[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.get<Manufacturer[]>('/manufacturers', token).then(setItems);
  }
  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/manufacturers', form, token);
    setForm(EMPTY);
    setShowForm(false);
    reload();
  }

  async function pay(id: string) {
    if (!payAmount) return;
    await api.post(`/manufacturers/${id}/payments`, { amount: Number(payAmount) }, token);
    setPayAmount('');
    setSelected(null);
    reload();
  }

  // Comme pour les clients/bons : la suppression n'efface jamais rien tout
  // de suite si le fabricant a son propre compte — elle attend son
  // approbation. Sans compte lié, elle s'applique tout de suite.
  async function remove(m: Manufacturer) {
    const reason = window.prompt(t('deleteReasonPrompt'));
    if (!reason) return;
    try {
      await api.post(`/manufacturers/${m.id}/request-deletion`, { reason }, token);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon('error'));
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.company?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q),
    );
  }, [items, search]);

  const sortedItems = useMemo(() => {
    const arr = [...filtered];
    switch (sortMode) {
      case 'name_asc':
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        arr.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'newest':
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'count_desc':
        arr.sort((a, b) => b._count.products - a._count.products);
        break;
      case 'count_asc':
        arr.sort((a, b) => a._count.products - b._count.products);
        break;
    }
    return arr;
  }, [filtered, sortMode]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <SortSelect
            value={sortMode}
            onChange={setSortMode}
            options={['newest', 'oldest', 'name_asc', 'name_desc', 'count_desc', 'count_asc']}
          />
          <button onClick={() => setShowForm((v) => !v)} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
            {t('add')}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1 text-sm sm:col-span-3">
            <span className="text-muted">{t('form.logo')}</span>
            <div className="flex items-center gap-3">
              {form.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="" className="h-12 w-12 rounded object-cover" />
              )}
              <ImageUploadButton
                folder="manufacturers"
                label={tCommon('uploadPhoto')}
                onUploaded={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
              />
            </div>
          </div>
          {(['name', 'company', 'phone', 'whatsapp', 'wilaya', 'contactName', 'paymentTerms'] as const).map((f) => (
            <label key={f} className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{t(`form.${f}`)}</span>
              <input
                value={form[f]}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                className="rounded border border-line bg-paper px-3 py-2"
              />
            </label>
          ))}
          <button type="submit" className="rounded bg-accent px-3 py-2 text-sm font-medium text-white sm:col-span-3">
            {tCommon('save')}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.name')}</th>
              <th className="px-4 py-2 text-start">{t('columns.company')}</th>
              <th className="px-4 py-2 text-start">{t('columns.phone')}</th>
              <th className="px-4 py-2 text-start">{t('columns.products')}</th>
              <th className="px-4 py-2 text-start">{t('columns.balance')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((m) => {
              const latest = m.pendingDeletions[0];
              const isPending = latest?.status === 'PENDING';
              const struckThrough = isPending;
              return (
                <tr
                  key={m.id}
                  onClick={() => router.push(`/${locale}/manufacturers/${m.id}`)}
                  className={`cursor-pointer border-t border-line hover:bg-line/20 ${isPending ? 'bg-amber-500/10' : ''}`}
                >
                  <td className={`px-4 py-2 font-medium text-ink ${struckThrough ? 'line-through opacity-60' : ''}`}>
                    <div className="flex items-center gap-2">
                      {m.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.logoUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded bg-line/40 text-xs text-muted">
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {m.name}
                      {m.userId && (
                        <span className="rounded bg-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-teal">{t('hasAccount')}</span>
                      )}
                    </div>
                    {isPending && <p className="text-[11px] text-amber-600">{t('pendingDeletion')} : {latest.reason}</p>}
                  </td>
                  <td className={`px-4 py-2 text-muted ${struckThrough ? 'line-through opacity-60' : ''}`}>{m.company}</td>
                  <td className={`px-4 py-2 font-mono text-xs ${struckThrough ? 'line-through opacity-60' : ''}`}>{m.phone}</td>
                  <td className="px-4 py-2 tabular">{m._count.products}</td>
                  <td className={`px-4 py-2 tabular font-medium ${m.balance > 0 ? 'text-accent' : 'text-teal'}`}>
                    {m.balance.toLocaleString()} DA
                  </td>
                  <td className="px-4 py-2 text-end" onClick={(e) => e.stopPropagation()}>
                    {selected === m.id ? (
                      <div className="flex justify-end gap-1">
                        <input
                          type="number"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="w-24 rounded border border-line px-2 py-1 text-xs"
                        />
                        <button onClick={() => pay(m.id)} className="rounded bg-teal px-2 py-1 text-xs text-white">
                          {tCommon('save')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setSelected(m.id)} className="text-xs text-accent hover:underline">
                          + {tCommon('add')}
                        </button>
                        {!isPending && (
                          <button onClick={() => remove(m)} className="text-xs text-red-600 hover:underline">
                            {tCommon('delete')}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
