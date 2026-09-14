'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface ProductOption {
  id: string;
  nameFr: string;
  packagingUnit: { label: string };
}
interface PurchaseItem {
  id: string;
  product: { id: string; nameFr: string };
  packagingUnit: { label: string };
  quantityPackages: number;
  totalUnits: number;
  unitCost: string;
  lineTotal: string;
}
interface Purchase {
  id: string;
  number: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  manufacturer: { name: string };
  discount: string;
  transportCost: string;
  paidAmount: string;
  cancelReason: string | null;
  items: PurchaseItem[];
}

export default function PurchaseEditorPage() {
  const t = useTranslations('purchases');
  const tVoucher = useTranslations('vouchers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [transportCost, setTransportCost] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reload() {
    api.get<Purchase>(`/purchase-vouchers/${id}`, token).then((p) => {
      setPurchase(p);
      setTransportCost(p.transportCost);
      setPaidAmount(p.paidAmount);
    });
  }

  useEffect(() => {
    if (token) {
      reload();
      api.get<{ items: ProductOption[] }>('/products?pageSize=200', token).then((r) => setProducts(r.items));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const isDraft = purchase?.status === 'DRAFT';

  const autoSave = useCallback(
    (patch: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        await api.put(`/purchase-vouchers/${id}`, patch, token);
        reload();
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, token],
  );

  function addItem() {
    if (!purchase || !selectedProductId || !unitCost) return;
    const existing = purchase.items.map((i) => ({ productId: i.product.id, quantityPackages: i.quantityPackages, unitCost: Number(i.unitCost) }));
    autoSave({ items: [...existing, { productId: selectedProductId, quantityPackages: Number(quantity), unitCost: Number(unitCost) }] });
    setSelectedProductId('');
    setQuantity('1');
    setUnitCost('');
  }

  function removeItem(productId: string) {
    if (!purchase) return;
    const items = purchase.items.filter((i) => i.product.id !== productId).map((i) => ({ productId: i.product.id, quantityPackages: i.quantityPackages, unitCost: Number(i.unitCost) }));
    autoSave({ items });
  }

  async function confirm() {
    setError(null);
    try {
      await api.post(`/purchase-vouchers/${id}/confirm`, undefined, token);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon('error'));
    }
  }

  async function cancel() {
    if (!cancelReason) return;
    await api.post(`/purchase-vouchers/${id}/cancel`, { reason: cancelReason }, token);
    setCancelReason('');
    reload();
  }

  if (!purchase) return <p className="text-muted">{tCommon('loading')}</p>;

  const subtotal = purchase.items.reduce((s, i) => s + Number(i.lineTotal), 0);
  const total = subtotal - Number(purchase.discount) + Number(transportCost);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <button onClick={() => router.push(`/${locale}/purchases`)} className="w-fit text-sm text-accent hover:underline">
        ← {tVoucher('back')}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-ink">{purchase.number ?? tVoucher('status.DRAFT')}</h1>
        <p className="text-sm text-muted">{purchase.manufacturer.name}</p>
      </div>

      {isDraft && (
        <div className="flex flex-wrap gap-2">
          <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="flex-1 rounded border border-line bg-panel px-3 py-2 text-sm">
            <option value="">{tVoucher('product')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameFr} ({p.packagingUnit.label})
              </option>
            ))}
          </select>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-20 rounded border border-line bg-panel px-3 py-2 text-sm" />
          <input type="number" placeholder={t('unitCost')} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-28 rounded border border-line bg-panel px-3 py-2 text-sm" />
          <button onClick={addItem} className="rounded bg-accent px-3 py-2 text-sm font-medium text-white">
            {tVoucher('addProduct')}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{tVoucher('product')}</th>
              <th className="px-4 py-2 text-start">{tVoucher('quantity')}</th>
              <th className="px-4 py-2 text-start">{t('unitCost')}</th>
              <th className="px-4 py-2 text-end">{tVoucher('total')}</th>
              {isDraft && <th></th>}
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="px-4 py-2 text-ink">{item.product.nameFr}</td>
                <td className="px-4 py-2 text-xs text-muted">
                  {item.quantityPackages} {item.packagingUnit.label} = {item.totalUnits} {tVoucher('pieces')}
                </td>
                <td className="px-4 py-2 tabular">{item.unitCost} DA</td>
                <td className="px-4 py-2 text-end tabular">{item.lineTotal} DA</td>
                {isDraft && (
                  <td className="px-2 py-2 text-end">
                    <button onClick={() => removeItem(item.product.id)} className="text-xs text-red-600 hover:underline">
                      {tVoucher('removeItem')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{tVoucher('transport')}</span>
          <input type="number" value={transportCost} disabled={!isDraft} onChange={(e) => { setTransportCost(e.target.value); autoSave({ transportCost: Number(e.target.value) }); }} className="rounded border border-line bg-panel px-3 py-2 disabled:opacity-60" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{tVoucher('paidAmount')}</span>
          <input type="number" value={paidAmount} disabled={!isDraft} onChange={(e) => { setPaidAmount(e.target.value); autoSave({ paidAmount: Number(e.target.value) }); }} className="rounded border border-line bg-panel px-3 py-2 disabled:opacity-60" />
        </label>
      </div>

      <div className="ms-auto w-full max-w-xs rounded-lg border border-line bg-panel p-4 text-sm">
        <div className="flex justify-between py-1 font-semibold text-ink">
          <span>{tVoucher('total')}</span>
          <span className="tabular">{total.toLocaleString()} DA</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isDraft && (
        <button onClick={confirm} className="w-fit rounded bg-teal px-4 py-2 text-sm font-medium text-white">
          {tVoucher('confirm')}
        </button>
      )}

      {purchase.status === 'CONFIRMED' && (
        <div className="flex flex-wrap items-center gap-3">
          <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={tVoucher('cancelReason')} className="rounded border border-line bg-panel px-3 py-2 text-sm" />
          <button onClick={cancel} disabled={!cancelReason} className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 disabled:opacity-40">
            {tVoucher('cancel')}
          </button>
        </div>
      )}

      {purchase.status === 'CANCELLED' && <p className="text-sm text-red-600">{purchase.cancelReason}</p>}
    </div>
  );
}
