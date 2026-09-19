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
  sku: string;
  unitsPerPackage: number;
  images: { url: string }[];
}

export default function StockPage() {
  const t = useTranslations('stock');
  const tProducts = useTranslations('products');
  const tCommon = useTranslations('common');
  const { token } = useAuth();

  const [alerts, setAlerts] = useState<ProductAlert[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<'pieces' | 'cartons'>('pieces');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');

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

  const filteredMovements = movements.filter((m) => {
    const q = movementSearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = [m.product.nameFr, m.product.sku, t(`movementTypes.${m.type}` as never), m.reason ?? '', String(m.quantity)]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const upp = selectedProduct?.unitsPerPackage || 1;
  const quantityDisplayValue =
    quantityUnit === 'pieces' || newQuantity === ''
      ? newQuantity
      : String(Math.round((Number(newQuantity) / upp) * 100) / 100);

  function onQuantityDisplayChange(v: string) {
    if (v === '') {
      setNewQuantity('');
      return;
    }
    const num = Number(v) || 0;
    setNewQuantity(String(quantityUnit === 'cartons' ? Math.round(num * upp) : Math.round(num)));
  }

  const pickerResults = products.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return `${p.sku} ${p.nameFr}`.toLowerCase().includes(q);
  });

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || newQuantity === '' || !reason) return;
    await api.post('/stock/adjust', { productId, newQuantity: Number(newQuantity), reason }, token);
    setProductId('');
    setNewQuantity('');
    setReason('');
    setProductSearch('');
    setQuantityUnit('pieces');
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

      {alerts.length > 0 && (
        <div className="rounded-lg border border-accent/30 bg-amber-50 p-4 dark:bg-amber-950/20">
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

        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => setShowProductPicker((v) => !v)}
            className="flex w-full items-center gap-2 rounded border border-line bg-paper px-3 py-2 text-start text-sm"
          >
            {selectedProduct?.images[0] ? (
              <span className="h-6 w-6 shrink-0 overflow-hidden rounded border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedProduct.images[0].url} alt="" className="h-full w-full object-cover" />
              </span>
            ) : null}
            <span className={selectedProduct ? 'text-ink' : 'text-muted'}>{selectedProduct?.nameFr ?? t('product')}</span>
          </button>
          {showProductPicker && (
            <div className="mt-2 rounded border border-line bg-panel p-2">
              <input
                type="search"
                autoFocus
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={tCommon('search')}
                className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
              />
              <div className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {pickerResults.slice(0, 24).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProductId(p.id);
                      setShowProductPicker(false);
                      setProductSearch('');
                    }}
                    className={`flex flex-col items-center gap-1 rounded border p-2 text-center hover:border-accent ${
                      p.id === productId ? 'border-accent' : 'border-line'
                    } bg-paper`}
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

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{t('newStock')}</span>
            <div className="flex overflow-hidden rounded border border-line text-[10px]">
              <button
                type="button"
                onClick={() => setQuantityUnit('pieces')}
                className={`px-1.5 py-0.5 ${quantityUnit === 'pieces' ? 'bg-accent text-white' : 'text-muted'}`}
              >
                {tProducts('form.stockPieces')}
              </button>
              <button
                type="button"
                onClick={() => setQuantityUnit('cartons')}
                className={`px-1.5 py-0.5 ${quantityUnit === 'cartons' ? 'bg-accent text-white' : 'text-muted'}`}
              >
                {tProducts('form.stockCartons')}
              </button>
            </div>
          </div>
          <input
            type="number"
            placeholder={t('newStock')}
            value={quantityDisplayValue}
            onChange={(e) => onQuantityDisplayChange(e.target.value)}
            className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>

        <input placeholder={t('reason')} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded border border-line bg-paper px-3 py-2 text-sm" />
        <button type="submit" className="rounded bg-accent px-3 py-2 text-sm font-medium text-white sm:col-span-4">
          {tCommon('save')}
        </button>
      </form>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{t('movements')}</h3>
          <input
            type="search"
            value={movementSearch}
            onChange={(e) => setMovementSearch(e.target.value)}
            placeholder={tCommon('search')}
            className="w-full max-w-xs rounded border border-line bg-panel px-3 py-1.5 text-sm"
          />
        </div>
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
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-sm text-muted">
                    {tCommon('empty')}
                  </td>
                </tr>
              )}
              {filteredMovements.map((m) => (
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
