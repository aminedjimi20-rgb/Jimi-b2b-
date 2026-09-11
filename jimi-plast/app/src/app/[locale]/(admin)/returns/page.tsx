'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Customer { id: string; user: { fullName: string } }
interface Manufacturer { id: string; name: string }
interface ProductOption { id: string; nameFr: string }
interface ReturnRow {
  id: string;
  number: string | null;
  type: 'CUSTOMER' | 'SUPPLIER';
  status: 'NEW' | 'VALIDATED' | 'REJECTED';
  totalValue: string;
  customer?: { user: { fullName: string } };
  manufacturer?: { name: string };
}

export default function ReturnsPage() {
  const t = useTranslations('returns');
  const tCommon = useTranslations('common');
  const { token } = useAuth();

  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [partyId, setPartyId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: number; reason: string }[]>([]);
  const [decisionByReturn, setDecisionByReturn] = useState<Record<string, string>>({});

  function reload() {
    api.get<ReturnRow[]>('/returns', token).then(setReturns);
  }
  useEffect(() => {
    if (token) {
      reload();
      api.get<Customer[]>('/customers', token).then(setCustomers);
      api.get<Manufacturer[]>('/manufacturers', token).then(setManufacturers);
      api.get<{ items: ProductOption[] }>('/products?pageSize=200', token).then((r) => setProducts(r.items));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function addItem() {
    if (!productId || !reason) return;
    const product = products.find((p) => p.id === productId);
    setItems([...items, { productId, productName: product?.nameFr ?? '', quantity: Number(quantity), reason }]);
    setProductId('');
    setQuantity('1');
    setReason('');
  }

  async function submit() {
    if (!partyId || items.length === 0) return;
    await api.post('/returns', {
      type,
      customerId: type === 'CUSTOMER' ? partyId : undefined,
      manufacturerId: type === 'SUPPLIER' ? partyId : undefined,
      items: items.map(({ productId, quantity, reason }) => ({ productId, quantity, reason })),
    }, token);
    setItems([]);
    setPartyId('');
    setShowForm(false);
    reload();
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <button onClick={() => setShowForm((v) => !v)} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
          {t('new')}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <div className="flex flex-wrap gap-2">
            <select value={type} onChange={(e) => { setType(e.target.value as never); setPartyId(''); }} className="rounded border border-line bg-paper px-3 py-2 text-sm">
              <option value="CUSTOMER">{t('typeCustomer')}</option>
              <option value="SUPPLIER">{t('typeSupplier')}</option>
            </select>
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="rounded border border-line bg-paper px-3 py-2 text-sm">
              <option value="">{t('party')}</option>
              {(type === 'CUSTOMER' ? customers : manufacturers).map((p) => (
                <option key={p.id} value={p.id}>
                  {'user' in p ? p.user.fullName : p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="rounded border border-line bg-paper px-3 py-2 text-sm">
              <option value="">{t('product')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.nameFr}</option>
              ))}
            </select>
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-24 rounded border border-line bg-paper px-3 py-2 text-sm" placeholder={t('quantity')} />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('reason')} className="rounded border border-line bg-paper px-3 py-2 text-sm" />
            <button onClick={addItem} className="rounded border border-line px-3 py-2 text-sm">{t('addItem')}</button>
          </div>

          {items.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {items.map((i, idx) => (
                <li key={idx} className="text-muted">
                  {i.productName} — {i.quantity} {t('quantity').split(' ')[1]} — {i.reason}
                </li>
              ))}
            </ul>
          )}

          <button onClick={submit} disabled={!partyId || items.length === 0} className="mt-3 rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {tCommon('save')}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.number')}</th>
              <th className="px-4 py-2 text-start">{t('columns.party')}</th>
              <th className="px-4 py-2 text-start">{t('columns.value')}</th>
              <th className="px-4 py-2 text-start">{t('columns.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2 font-mono text-xs">{r.number ?? '—'}</td>
                <td className="px-4 py-2 text-ink">{r.customer?.user.fullName ?? r.manufacturer?.name}</td>
                <td className="px-4 py-2 tabular">{Number(r.totalValue).toLocaleString()} DA</td>
                <td className="px-4 py-2 text-xs">{t(`status.${r.status}` as never)}</td>
                <td className="px-4 py-2 text-end">
                  {r.status === 'NEW' && (
                    <div className="flex justify-end gap-1">
                      <select value={decisionByReturn[r.id] ?? ''} onChange={(e) => setDecisionByReturn({ ...decisionByReturn, [r.id]: e.target.value })} className="rounded border border-line px-2 py-1 text-xs">
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
