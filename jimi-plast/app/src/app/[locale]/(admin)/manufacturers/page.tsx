'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';
import { SortSelect, type SortMode } from '@/components/sort-select';

interface Manufacturer {
  id: string;
  name: string;
  logoUrl: string | null;
  company: string | null;
  phone: string | null;
  wilaya: string | null;
  balance: number;
  createdAt: string;
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
  const [items, setItems] = useState<Manufacturer[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

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

  const sortedItems = useMemo(() => {
    const arr = [...items];
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
  }, [items, sortMode]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
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
        <table className="w-full min-w-[600px] text-sm">
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
            {sortedItems.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium text-ink">
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
                  </div>
                </td>
                <td className="px-4 py-2 text-muted">{m.company}</td>
                <td className="px-4 py-2 font-mono text-xs">{m.phone}</td>
                <td className="px-4 py-2 tabular">{m._count.products}</td>
                <td className={`px-4 py-2 tabular font-medium ${m.balance > 0 ? 'text-accent' : 'text-teal'}`}>
                  {m.balance.toLocaleString()} DA
                </td>
                <td className="px-4 py-2 text-end">
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
                    <button onClick={() => setSelected(m.id)} className="text-xs text-accent hover:underline">
                      + {tCommon('add')}
                    </button>
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
