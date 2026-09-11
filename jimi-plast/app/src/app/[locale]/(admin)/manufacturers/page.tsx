'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Manufacturer {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  wilaya: string | null;
  balance: number;
}

const EMPTY = { name: '', company: '', phone: '', whatsapp: '', wilaya: '', contactName: '', paymentTerms: '' };

export default function ManufacturersPage() {
  const t = useTranslations('manufacturers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const [items, setItems] = useState<Manufacturer[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <button onClick={() => setShowForm((v) => !v)} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
          {t('add')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-3">
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
              <th className="px-4 py-2 text-start">{t('columns.balance')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium text-ink">{m.name}</td>
                <td className="px-4 py-2 text-muted">{m.company}</td>
                <td className="px-4 py-2 font-mono text-xs">{m.phone}</td>
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
