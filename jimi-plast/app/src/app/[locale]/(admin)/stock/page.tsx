'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface ProductAlert {
  id: string;
  nameFr: string;
  currentStock: number;
  stockMin: number;
}
interface Movement {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: { nameFr: string; sku: string };
}
interface ProductOption {
  id: string;
  nameFr: string;
}

export default function StockPage() {
  const t = useTranslations('stock');
  const tCommon = useTranslations('common');
  const { token } = useAuth();

  const [alerts, setAlerts] = useState<ProductAlert[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState('');

  function reload() {
    api.get<ProductAlert[]>('/stock/alerts', token).then(setAlerts);
    api.get<Movement[]>('/stock/movements', token).then(setMovements);
  }

  useEffect(() => {
    if (token) {
      reload();
      api.get<{ items: ProductOption[] }>('/products?pageSize=200', token).then((r) => setProducts(r.items));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || newQuantity === '' || !reason) return;
    await api.post('/stock/adjust', { productId, newQuantity: Number(newQuantity), reason }, token);
    setProductId('');
    setNewQuantity('');
    setReason('');
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

      {alerts.length > 0 && (
        <div className="rounded-lg border border-accent/30 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-accent">{t('alerts')}</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="text-ink">
                {a.nameFr} — {a.currentStock} / {a.stockMin}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submitAdjust} className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-4">
        <h3 className="text-sm font-semibold text-ink sm:col-span-4">{t('adjust')}</h3>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="rounded border border-line bg-paper px-3 py-2 text-sm sm:col-span-2">
          <option value="">{t('product')}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nameFr}
            </option>
          ))}
        </select>
        <input type="number" placeholder={t('newStock')} value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className="rounded border border-line bg-paper px-3 py-2 text-sm" />
        <input placeholder={t('reason')} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded border border-line bg-paper px-3 py-2 text-sm" />
        <button type="submit" className="rounded bg-accent px-3 py-2 text-sm font-medium text-white sm:col-span-4">
          {tCommon('save')}
        </button>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">{t('movements')}</h3>
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-sm">
            <thead className="bg-line/30 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-start">{t('columns.date')}</th>
                <th className="px-4 py-2 text-start">{t('columns.product')}</th>
                <th className="px-4 py-2 text-start">{t('columns.type')}</th>
                <th className="px-4 py-2 text-end">{t('columns.quantity')}</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-2 font-mono text-xs text-muted">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-ink">{m.product.nameFr}</td>
                  <td className="px-4 py-2 text-xs">{t(`movementTypes.${m.type}` as never)}</td>
                  <td className={`px-4 py-2 text-end tabular ${m.quantity > 0 ? 'text-teal' : 'text-accent'}`}>
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
