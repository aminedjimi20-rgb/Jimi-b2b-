'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';

interface PickerProduct {
  id: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  category: { id: string; nameFr: string; nameAr: string | null; nameEn: string | null };
  packagingUnit: { label: string };
  unitsPerPackage: number;
  images: { url: string }[];
  availability: 'IN_STOCK' | 'OUT_OF_STOCK';
  currentStock: number | null;
}
interface PurchaseItem {
  id: string;
  product: { id: string; nameFr: string };
  packagingUnit: { label: string };
  quantityPackages: number;
  totalUnits: number;
  actualTotalUnits: number | null;
  unitCost: string;
  lineTotal: string;
  modifiedAt: string | null;
}
interface HistoryEntry {
  id: string;
  action: string;
  field: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  actor: { fullName: string } | null;
}
interface PendingDeletion {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
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
  pendingDeletions: PendingDeletion[];
}

const localizedName = (item: { nameFr: string; nameAr?: string | null; nameEn?: string | null }, locale: string) => {
  if (locale === 'ar' && item.nameAr) return item.nameAr;
  if (locale === 'en' && item.nameEn) return item.nameEn;
  return item.nameFr;
};

// Champs numériques en type="text" + inputMode plutôt que type="number" : les
// inputs number contrôlés perdent des frappes sur mobile — même bug que sur
// le bon de vente, même solution.
const onlyDigits = (v: string) => v.replace(/[^0-9]/g, '');
const onlyDecimal = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

export default function PurchaseEditorPage() {
  const t = useTranslations('purchases');
  const tVoucher = useTranslations('vouchers');
  const tCatalog = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [transportCost, setTransportCost] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sélecteur de produit : recherche + vignettes, même système que le bon de vente.
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<PickerProduct[]>([]);
  const [addingProduct, setAddingProduct] = useState<PickerProduct | null>(null);
  const [modalQty, setModalQty] = useState('1');
  const [modalUnitsPerPackage, setModalUnitsPerPackage] = useState('');
  const [modalPieces, setModalPieces] = useState('');
  const [modalMissingPieces, setModalMissingPieces] = useState('0');
  const [modalUnitCost, setModalUnitCost] = useState('');

  function reload() {
    api.get<Purchase>(`/purchase-vouchers/${id}`, token).then((p) => {
      setPurchase(p);
      setTransportCost(p.transportCost);
      setPaidAmount(p.paidAmount);
    });
    api.get<HistoryEntry[]>(`/purchase-vouchers/${id}/history`, token).then(setHistory).catch(() => setHistory([]));
  }

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  useEffect(() => {
    if (!token || !showPicker) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (pickerQuery) params.set('search', pickerQuery);
      params.set('pageSize', '100');
      api.get<{ items: PickerProduct[] }>(`/products?${params.toString()}`, token).then((res) => setPickerResults(res.items));
    }, 250);
    return () => clearTimeout(timeout);
  }, [token, showPicker, pickerQuery]);

  const isDraft = purchase?.status === 'DRAFT';
  const canReopen = purchase?.status === 'CONFIRMED';
  const editable = isDraft || editMode;
  const deletion = purchase?.pendingDeletions[0];
  const isPending = deletion?.status === 'PENDING';
  const isApproved = deletion?.status === 'APPROVED';

  const autoSave = useCallback(
    (patch: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await api.put(`/purchase-vouchers/${id}`, patch, token);
          reload();
        } catch {
          setError(tCommon('error'));
        }
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, token],
  );

  function openAddModal(p: PickerProduct) {
    setAddingProduct(p);
    setModalQty('1');
    setModalUnitsPerPackage(String(p.unitsPerPackage));
    setModalPieces(String(p.unitsPerPackage));
    setModalMissingPieces('0');
    setModalUnitCost('');
  }

  function onModalQtyChange(v: string) {
    const clean = onlyDigits(v);
    setModalQty(clean);
    if (!addingProduct) return;
    const qty = Math.max(0, Number(clean) || 0);
    const upp = Number(modalUnitsPerPackage) > 0 ? Number(modalUnitsPerPackage) : addingProduct.unitsPerPackage;
    const missing = Math.max(0, Number(modalMissingPieces) || 0);
    setModalPieces(String(Math.max(0, qty * upp - missing)));
  }

  function onModalUnitsPerPackageChange(v: string) {
    const clean = onlyDigits(v);
    setModalUnitsPerPackage(clean);
    const qty = Math.max(0, Number(modalQty) || 0);
    const upp = Math.max(0, Number(clean) || 0);
    const missing = Math.max(0, Number(modalMissingPieces) || 0);
    setModalPieces(String(Math.max(0, qty * upp - missing)));
  }

  // Champ dédié "Pièces manquantes" : évite de calculer le total réel de tête
  // (8 cartons de 100 dont un incomplet de 4 → on tape juste 4).
  function onModalMissingPiecesChange(v: string) {
    const clean = onlyDigits(v);
    setModalMissingPieces(clean);
    if (!addingProduct) return;
    const qty = Math.max(0, Number(modalQty) || 0);
    const upp = Number(modalUnitsPerPackage) > 0 ? Number(modalUnitsPerPackage) : addingProduct.unitsPerPackage;
    const missing = Math.max(0, Number(clean) || 0);
    setModalPieces(String(Math.max(0, qty * upp - missing)));
  }

  // La quantité (cartons) déduite/ajoutée au stock dérive toujours du
  // conditionnement catalogue (fixe) ; ce champ ne sert qu'à noter un carton
  // reçu incomplet — jamais à perdre le nombre de pièces réellement tapé.
  function onModalPiecesChange(v: string) {
    const clean = onlyDigits(v);
    setModalPieces(clean);
    if (!addingProduct) return;
    const pieces = Math.max(0, Number(clean) || 0);
    const qty = Math.max(1, Math.ceil(pieces / addingProduct.unitsPerPackage));
    setModalQty(String(qty));
    setModalMissingPieces(String(Math.max(0, qty * addingProduct.unitsPerPackage - pieces)));
  }

  function confirmAddToPurchase() {
    if (!purchase || !addingProduct) return;
    const qty = Math.max(1, Number(modalQty) || 1);
    const cost = Math.max(0, Number(modalUnitCost) || 0);
    const pieces = Math.max(0, Number(modalPieces) || 0);
    const nominalUnits = qty * addingProduct.unitsPerPackage;
    const hasCustomPieces = pieces > 0 && pieces !== nominalUnits;
    const addedUnits = hasCustomPieces ? pieces : nominalUnits;

    const existingItems = purchase.items.map((i) => ({
      productId: i.product.id,
      quantityPackages: i.quantityPackages,
      unitCost: Number(i.unitCost),
      actualTotalUnits: i.actualTotalUnits ?? undefined,
    }));
    const existingIndex = existingItems.findIndex((i) => i.productId === addingProduct.id);
    const newItems =
      existingIndex >= 0
        ? existingItems.map((i, idx) => {
            if (idx !== existingIndex) return i;
            const mergedQty = i.quantityPackages + qty;
            const prevUnits = i.actualTotalUnits ?? i.quantityPackages * addingProduct.unitsPerPackage;
            const mergedUnits = prevUnits + addedUnits;
            return {
              productId: i.productId,
              quantityPackages: mergedQty,
              unitCost: cost,
              actualTotalUnits: mergedUnits !== mergedQty * addingProduct.unitsPerPackage ? mergedUnits : undefined,
            };
          })
        : [...existingItems, { productId: addingProduct.id, quantityPackages: qty, unitCost: cost, actualTotalUnits: hasCustomPieces ? pieces : undefined }];

    autoSave({ items: newItems });
    setAddingProduct(null);
    setPickerQuery('');
  }

  function removeItem(productId: string) {
    if (!purchase) return;
    const items = purchase.items
      .filter((i) => i.product.id !== productId)
      .map((i) => ({ productId: i.product.id, quantityPackages: i.quantityPackages, unitCost: Number(i.unitCost), actualTotalUnits: i.actualTotalUnits ?? undefined }));
    autoSave({ items });
  }

  async function viewPdf() {
    // window.open synchrone dans le gestionnaire de clic — sinon les
    // bloqueurs de popups (Safari/iOS) le bloquent après le premier "await".
    const win = window.open('', '_blank');
    setLoadingPdf(true);
    try {
      const blob = await api.getBlob(`/purchase-vouchers/${id}/pdf`, token);
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch {
      win?.close();
      setError(tCommon('error'));
    } finally {
      setLoadingPdf(false);
    }
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

  async function revertCancel() {
    if (!window.confirm(tVoucher('revertCancelConfirm'))) return;
    await api.post(`/purchase-vouchers/${id}/revert-cancel`, undefined, token);
    reload();
  }

  // Comme pour un bon de vente : la suppression n'efface rien tout de suite
  // — elle attend l'approbation du fabricant (s'il a son propre compte), et
  // le bon reste affiché (barré) pour de bon.
  async function requestDeletion() {
    const reason = window.prompt(tVoucher('deleteReasonPrompt'));
    if (!reason) return;
    try {
      await api.post(`/purchase-vouchers/${id}/request-deletion`, { reason }, token);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tCommon('error'));
    }
  }

  if (!purchase) return <p className="text-muted">{tCommon('loading')}</p>;

  const subtotal = purchase.items.reduce((s, i) => s + Number(i.lineTotal), 0);
  const total = subtotal - Number(purchase.discount) + Number(transportCost);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <button onClick={() => router.push(`/${locale}/purchases`)} className="w-fit text-sm text-accent hover:underline">
        ← {tVoucher('back')}
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{purchase.number ?? tVoucher('status.DRAFT')}</h1>
          <p className="text-sm text-muted">{purchase.manufacturer.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {canReopen && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`rounded border px-3 py-1.5 text-sm ${editMode ? 'border-teal bg-teal/10 text-teal' : 'border-line text-ink hover:bg-line/30'}`}
            >
              {editMode ? tCommon('done') : tVoucher('modify')}
            </button>
          )}
          {!isDraft && (
            <button
              onClick={viewPdf}
              disabled={loadingPdf}
              className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30 disabled:opacity-50"
            >
              {loadingPdf ? tCommon('loading') : tVoucher('viewPdf')}
            </button>
          )}
          {!isDraft && !isPending && !isApproved && (
            <button onClick={requestDeletion} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              {tVoucher('deleteVoucher')}
            </button>
          )}
        </div>
      </div>

      {deletion && (isPending || isApproved) && (
        <p className={`rounded border px-3 py-2 text-xs ${isApproved ? 'border-red-300 bg-red-50 text-red-600' : 'border-amber-400 bg-amber-500/10 text-amber-700'}`}>
          {isApproved ? tVoucher('detailDeleted') : tVoucher('detailPendingDeletion')} : {deletion.reason}
        </p>
      )}

      {editMode && <p className="rounded border border-teal/40 bg-teal/10 px-3 py-2 text-xs text-teal">{tVoucher('editModeWarning')}</p>}

      {editable && (
        <div className="flex flex-col gap-3">
          <button onClick={() => setShowPicker((v) => !v)} className="w-fit rounded bg-accent px-3 py-2 text-sm font-medium text-white">
            {showPicker ? tCommon('cancel') : tVoucher('addProduct')}
          </button>

          {showPicker && (
            <div className="rounded-lg border border-line bg-panel p-3">
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder={tCommon('search')}
                className="w-full rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />

              <div className="mt-3">
                {pickerResults.length === 0 && <p className="py-4 text-center text-xs text-muted">{tCatalog('noResults')}</p>}
                <div className="grid grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-2" style={{ gridAutoColumns: '5.5rem' }}>
                  {pickerResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => openAddModal(p)}
                      className="flex w-[5.5rem] flex-col items-center gap-1 rounded border border-line p-1.5 text-center cursor-pointer hover:bg-line/20"
                    >
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-paper text-muted">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0].url} alt={localizedName(p, locale)} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-lg">📦</span>
                        )}
                      </div>
                      <p className="line-clamp-2 w-full text-[11px] font-medium leading-tight text-ink">{localizedName(p, locale)}</p>
                      <span
                        className={`text-[9px] ${p.availability === 'IN_STOCK' ? 'text-teal' : 'text-red-600'}`}
                      >
                        {p.availability === 'IN_STOCK' ? tCatalog('inStock') : tCatalog('outOfStock')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
              {editable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((item) => (
              <tr key={item.id} className={`border-t border-line ${item.modifiedAt ? 'bg-amber-500/10' : ''}`}>
                <td className="px-4 py-2 text-ink">{item.product.nameFr}</td>
                <td className="px-4 py-2 text-xs text-muted">
                  {item.quantityPackages} {item.packagingUnit.label} = {item.totalUnits} {tVoucher('pieces')}
                  {item.actualTotalUnits != null && item.actualTotalUnits !== item.totalUnits && (
                    <span className="text-amber-600">
                      {' '}
                      ({tCatalog('minus')} {item.totalUnits - item.actualTotalUnits} {tVoucher('pieces')} = {item.actualTotalUnits} {tVoucher('pieces')})
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 tabular">{item.unitCost} DA</td>
                <td className="px-4 py-2 text-end tabular">{item.lineTotal} DA</td>
                {editable && (
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
          <input type="number" value={transportCost} disabled={!editable} onChange={(e) => { setTransportCost(e.target.value); autoSave({ transportCost: Number(e.target.value) }); }} className="rounded border border-line bg-panel px-3 py-2 disabled:opacity-60" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{tVoucher('paidAmount')}</span>
          <input type="number" value={paidAmount} disabled={!editable} onChange={(e) => { setPaidAmount(e.target.value); autoSave({ paidAmount: Number(e.target.value) }); }} className="rounded border border-line bg-panel px-3 py-2 disabled:opacity-60" />
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

      {purchase.status === 'CANCELLED' && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-600">{purchase.cancelReason}</p>
          <button onClick={revertCancel} className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30">
            {tVoucher('revertCancel')}
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">{tVoucher('history')}</h2>
          <ul className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel p-3 text-xs">
            {history.map((h) => (
              <li key={h.id} className="border-b border-line/50 pb-1.5 last:border-0 last:pb-0">
                <span className="text-muted">{new Date(h.createdAt).toLocaleString('fr-FR')}</span>
                {' — '}
                <span className="font-medium text-ink">{h.actor?.fullName ?? tVoucher('system')}</span>
                {' : '}
                <span className="text-ink">{h.reason ?? `${h.field ?? ''} → ${h.newValue ?? ''}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {addingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddingProduct(null)}>
          <div className="w-full max-w-sm rounded-lg bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-sm font-semibold text-ink">{localizedName(addingProduct, locale)}</h2>
            <p className="mb-3 text-xs font-medium text-accent">
              {tCatalog('piecesPerPackage', { count: addingProduct.unitsPerPackage, unit: addingProduct.packagingUnit.label })}
            </p>

            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{tCatalog('quantityCartons')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={modalQty}
                  onChange={(e) => onModalQtyChange(e.target.value)}
                  className="rounded border border-line bg-paper px-2 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{tCatalog('unitsPerPackage')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={modalUnitsPerPackage}
                  onChange={(e) => onModalUnitsPerPackageChange(e.target.value)}
                  className={`rounded border bg-paper px-2 py-2 ${
                    Number(modalUnitsPerPackage) !== addingProduct.unitsPerPackage ? 'border-amber-500 text-amber-600' : 'border-line'
                  }`}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{tCatalog('totalPieces')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={modalPieces}
                  onChange={(e) => onModalPiecesChange(e.target.value)}
                  className={`rounded border bg-paper px-2 py-2 ${
                    Number(modalPieces) !== Math.max(0, Number(modalQty) || 0) * Math.max(0, Number(modalUnitsPerPackage) || 0)
                      ? 'border-amber-500 text-amber-600'
                      : 'border-line'
                  }`}
                />
              </label>
            </div>
            {(Number(modalUnitsPerPackage) !== addingProduct.unitsPerPackage ||
              Number(modalPieces) !== Math.max(0, Number(modalQty) || 0) * Math.max(0, Number(modalUnitsPerPackage) || 0)) && (
              <p className="mt-1 text-[11px] font-medium text-amber-600">{tCatalog('adjustedWarning')}</p>
            )}
            <p className="mt-1 text-[11px] text-muted">{tCatalog('piecesHint')}</p>

            <label className="mt-2 flex flex-col gap-1 text-sm">
              <span className="text-muted">{tCatalog('missingPieces')}</span>
              <input
                type="text"
                inputMode="numeric"
                value={modalMissingPieces}
                onChange={(e) => onModalMissingPiecesChange(e.target.value)}
                className={`rounded border bg-paper px-2 py-2 ${
                  Number(modalMissingPieces) > 0 ? 'border-amber-500 text-amber-600' : 'border-line'
                }`}
              />
            </label>

            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="text-muted">{t('unitCost')}</span>
              <input
                type="text"
                inputMode="decimal"
                value={modalUnitCost}
                onChange={(e) => setModalUnitCost(onlyDecimal(e.target.value))}
                className="rounded border border-line bg-paper px-3 py-2"
              />
            </label>

            <div className="mt-3 flex justify-between text-sm font-semibold text-ink">
              <span>{tVoucher('total')}</span>
              <span className="tabular">
                {(Math.max(0, Number(modalPieces) || 0) * Math.max(0, Number(modalUnitCost) || 0)).toLocaleString()} DA
              </span>
            </div>

            <button onClick={confirmAddToPurchase} className="mt-4 w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white">
              {tCatalog('confirmAdd')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
