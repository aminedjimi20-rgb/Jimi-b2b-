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
interface VoucherItem {
  id: string;
  product: { id: string; nameFr: string };
  packagingUnit: { label: string };
  quantityPackages: number;
  totalUnits: number;
  unitPrice: string;
  lineTotal: string;
}
interface Voucher {
  id: string;
  number: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  customerId: string;
  customer: { businessName: string | null; user: { fullName: string } };
  discount: string;
  transportCost: string;
  paidAmount: string;
  previousCredit: string | null;
  notes: string | null;
  cancelReason: string | null;
  items: VoucherItem[];
}

export default function VoucherEditorPage() {
  const t = useTranslations('vouchers');
  const tCommon = useTranslations('common');
  const { token, hasPermission } = useAuth();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();
  const canManage = hasPermission('vouchers.create');
  const basePath = canManage ? '/vouchers' : '/vouchers/mine';

  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');
  const [transportCost, setTransportCost] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reload() {
    api.get<Voucher>(`${basePath}/${id}`, token).then((v) => {
      setVoucher(v);
      setDiscount(v.discount);
      setTransportCost(v.transportCost);
      setPaidAmount(v.paidAmount);
      setNotes(v.notes ?? '');
    });
  }

  useEffect(() => {
    if (token) {
      reload();
      api.get<{ items: ProductOption[] }>('/products?pageSize=200', token).then((r) => setProducts(r.items));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const isDraft = voucher?.status === 'DRAFT';

  const autoSave = useCallback(
    (patch: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await api.put(`${basePath}/${id}`, patch, token);
          setSavedAt(new Date());
          reload();
        } catch {
          setError(tCommon('error'));
        }
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, token, basePath],
  );

  function addItem() {
    if (!voucher || !selectedProductId) return;
    const existingItems = voucher.items.map((i) => ({ productId: i.product.id, quantityPackages: i.quantityPackages }));
    autoSave({ items: [...existingItems, { productId: selectedProductId, quantityPackages: Number(quantity) }] });
    setSelectedProductId('');
    setQuantity('1');
  }

  function removeItem(productId: string) {
    if (!voucher) return;
    const items = voucher.items
      .filter((i) => i.product.id !== productId)
      .map((i) => ({ productId: i.product.id, quantityPackages: i.quantityPackages }));
    autoSave({ items });
  }

  async function confirmVoucher() {
    setError(null);
    try {
      await api.post(`/vouchers/${id}/confirm`, undefined, token);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon('error'));
    }
  }

  async function deliverVoucher() {
    await api.post(`/vouchers/${id}/deliver`, undefined, token);
    reload();
  }

  async function cancelVoucher() {
    if (!cancelReason) return;
    await api.post(`/vouchers/${id}/cancel`, { reason: cancelReason }, token);
    setCancelReason('');
    reload();
  }

  if (!voucher) return <p className="text-muted">{tCommon('loading')}</p>;

  const subtotal = voucher.items.reduce((s, i) => s + Number(i.lineTotal), 0);
  const total = subtotal - Number(discount) + Number(transportCost);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <button
        onClick={() => router.push(`/${locale}/${canManage ? 'vouchers' : 'catalog'}`)}
        className="w-fit text-sm text-accent hover:underline"
      >
        ← {canManage ? t('back') : t('backToCatalog')}
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{voucher.number ?? t('status.DRAFT')}</h1>
          <p className="text-sm text-muted">{voucher.customer.user.fullName}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && savedAt && <span className="text-xs text-muted">{t('autoSaved')} {savedAt.toLocaleTimeString()}</span>}
          {canManage && (
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL}/vouchers/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30"
            >
              {t('viewPdf')}
            </a>
          )}
        </div>
      </div>

      {isDraft && (
        <div className="flex gap-2">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="flex-1 rounded border border-line bg-panel px-3 py-2 text-sm"
          >
            <option value="">{t('product')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameFr} ({p.packagingUnit.label})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24 rounded border border-line bg-panel px-3 py-2 text-sm"
          />
          <button onClick={addItem} className="rounded bg-accent px-3 py-2 text-sm font-medium text-white">
            {t('addProduct')}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('product')}</th>
              <th className="px-4 py-2 text-start">{t('quantity')}</th>
              <th className="px-4 py-2 text-start">{t('unitPrice')}</th>
              <th className="px-4 py-2 text-end">{t('total')}</th>
              {isDraft && <th></th>}
            </tr>
          </thead>
          <tbody>
            {voucher.items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="px-4 py-2 text-ink">{item.product.nameFr}</td>
                <td className="px-4 py-2 text-xs text-muted">
                  {item.quantityPackages} {item.packagingUnit.label} = {item.totalUnits} {t('pieces')}
                </td>
                <td className="px-4 py-2 tabular">{item.unitPrice} DA</td>
                <td className="px-4 py-2 text-end tabular">{item.lineTotal} DA</td>
                {isDraft && (
                  <td className="px-2 py-2 text-end">
                    <button onClick={() => removeItem(item.product.id)} className="text-xs text-red-600 hover:underline">
                      {t('removeItem')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumField label={t('discount')} value={discount} disabled={!isDraft} onChange={(v) => { setDiscount(v); autoSave({ discount: Number(v) }); }} />
        <NumField label={t('transport')} value={transportCost} disabled={!isDraft} onChange={(v) => { setTransportCost(v); autoSave({ transportCost: Number(v) }); }} />
        <NumField label={t('paidAmount')} value={paidAmount} disabled={!isDraft} onChange={(v) => { setPaidAmount(v); autoSave({ paidAmount: Number(v) }); }} />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('notes')}</span>
        <textarea
          value={notes}
          disabled={!isDraft}
          onChange={(e) => { setNotes(e.target.value); autoSave({ notes: e.target.value }); }}
          rows={2}
          className={`rounded border px-3 py-2 ${
            notes.includes('⚠') ? 'border-amber-500 bg-amber-500/10 text-amber-700' : 'border-line bg-panel'
          }`}
        />
      </label>

      <div className="ms-auto w-full max-w-xs rounded-lg border border-line bg-panel p-4 text-sm">
        <Row label={t('subtotal')} value={subtotal} />
        <Row label={t('total')} value={total} bold />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isDraft && canManage && (
        <div>
          <p className="mb-2 text-xs text-muted">{t('confirmWarning')}</p>
          <button onClick={confirmVoucher} className="rounded bg-teal px-4 py-2 text-sm font-medium text-white">
            {t('confirm')}
          </button>
        </div>
      )}

      {isDraft && !canManage && (
        <p className="text-xs text-muted">{t('waitingForStaffConfirmation')}</p>
      )}

      {voucher.status === 'CONFIRMED' && canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={deliverVoucher} className="rounded bg-teal px-4 py-2 text-sm font-medium text-white">
            {t('deliver')}
          </button>
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('cancelReason')}
            className="rounded border border-line bg-panel px-3 py-2 text-sm"
          />
          <button onClick={cancelVoucher} disabled={!cancelReason} className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 disabled:opacity-40">
            {t('cancel')}
          </button>
        </div>
      )}

      {voucher.status === 'CANCELLED' && (
        <p className="text-sm text-red-600">{voucher.cancelReason}</p>
      )}
    </div>
  );
}

function NumField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-line bg-panel px-3 py-2 disabled:opacity-60"
      />
    </label>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? 'font-semibold text-ink' : 'text-muted'}`}>
      <span>{label}</span>
      <span className="tabular">{value.toLocaleString()} DA</span>
    </div>
  );
}
