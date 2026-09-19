'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageLightbox } from '@/components/image-lightbox';
import { ImageUploadButton } from '@/components/image-upload-button';
import { openOrSharePdf, supportsPdfShare } from '@/lib/pdf-share';

interface ReturnItem {
  id: string;
  quantity: number;
  reason: string;
  condition: 'DAMAGED' | 'DEFECTIVE' | 'OTHER';
  unitPrice: string;
  lineTotal: string;
  product: { nameFr: string; images: { url: string }[] };
  images: { id: string; url: string }[];
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
interface ReturnDetail {
  id: string;
  number: string | null;
  type: 'CUSTOMER' | 'SUPPLIER';
  status: 'NEW' | 'VALIDATED' | 'REJECTED';
  decision: 'REFUND' | 'CREDIT_NOTE' | 'DEDUCT_NEXT' | 'REPLACEMENT' | null;
  totalValue: string;
  notes: string | null;
  createdAt: string;
  customerId?: string | null;
  manufacturerId?: string | null;
  customer?: { user: { fullName: string } };
  manufacturer?: { name: string };
  items: ReturnItem[];
  attachments: { id: string; url: string; createdAt: string }[];
}
interface PickerProduct {
  id: string;
  sku: string;
  nameFr: string;
  costPrice: number | null;
  images: { url: string }[];
}

const CONDITIONS: ReturnItem['condition'][] = ['DAMAGED', 'DEFECTIVE', 'OTHER'];

export default function ReturnDetailPage() {
  const t = useTranslations('returns');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();

  const [ret, setRet] = useState<ReturnDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [decision, setDecision] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxAttachmentIndex, setLightboxAttachmentIndex] = useState<number | null>(null);
  const [viewingItemImages, setViewingItemImages] = useState<{ images: { url: string }[]; title: string } | null>(null);

  const [notes, setNotes] = useState('');
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<PickerProduct[]>([]);
  const [addingProduct, setAddingProduct] = useState<PickerProduct | null>(null);
  const [modalQty, setModalQty] = useState('1');
  const [modalReason, setModalReason] = useState('');
  const [modalCondition, setModalCondition] = useState<ReturnItem['condition']>('DAMAGED');
  const [modalUnitPrice, setModalUnitPrice] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  function reload() {
    api.get<ReturnDetail>(`/returns/${id}`, token).then((r) => {
      setRet(r);
      setNotes(r.notes ?? '');
    });
    api.get<HistoryEntry[]>(`/returns/${id}/history`, token).then(setHistory).catch(() => setHistory([]));
  }

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const partyId = ret?.type === 'SUPPLIER' ? ret.manufacturerId : undefined;

  useEffect(() => {
    if (!token || !showPicker) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (pickerQuery) params.set('search', pickerQuery);
      if (partyId) params.set('manufacturerId', partyId);
      params.set('pageSize', '100');
      api.get<{ items: PickerProduct[] }>(`/products?${params.toString()}`, token).then((res) => setPickerResults(res.items));
    }, 250);
    return () => clearTimeout(timeout);
  }, [token, showPicker, pickerQuery, partyId]);

  async function viewPdf() {
    const win = supportsPdfShare() ? null : window.open('', '_blank');
    setLoadingPdf(true);
    try {
      await openOrSharePdf(() => api.getBlob(`/returns/${id}/pdf`, token), `${ret?.number ?? 'retour'}.pdf`, win);
    } catch {
      win?.close();
      setError(tCommon('error'));
    } finally {
      setLoadingPdf(false);
    }
  }

  function onNotesChange(v: string) {
    setNotes(v);
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(async () => {
      await api.post(`/returns/${id}/notes`, { notes: v }, token);
    }, 600);
  }

  async function addAttachment(url: string) {
    await api.post(`/returns/${id}/attachments`, { url }, token);
    reload();
  }
  async function removeAttachment(attachmentId: string) {
    await api.delete(`/returns/${id}/attachments/${attachmentId}`, token);
    reload();
  }
  async function addItemImage(itemId: string, url: string) {
    await api.post(`/returns/${id}/items/${itemId}/images`, { url }, token);
    reload();
  }
  async function removeItemImage(itemId: string, imageId: string) {
    await api.delete(`/returns/${id}/items/${itemId}/images/${imageId}`, token);
    reload();
  }

  async function validate() {
    if (!decision) return;
    await api.post(`/returns/${id}/validate`, { decision }, token);
    reload();
  }
  async function reject() {
    await api.post(`/returns/${id}/reject`, undefined, token);
    reload();
  }

  async function removeReturn() {
    if (!window.confirm(t('deleteConfirm'))) return;
    await api.delete(`/returns/${id}`, token);
    router.push(`/${locale}/returns`);
  }

  function openAddModal(p: PickerProduct) {
    setAddingProduct(p);
    setModalQty('1');
    setModalReason('');
    setModalCondition('DAMAGED');
    setModalUnitPrice(ret?.type === 'SUPPLIER' && p.costPrice != null ? String(p.costPrice) : '');
  }

  async function confirmAddItem() {
    if (!addingProduct || !modalReason.trim() || Number(modalQty) < 1) return;
    setAddingItem(true);
    try {
      await api.post(`/returns/${id}/items`, {
        items: [
          {
            productId: addingProduct.id,
            quantity: Number(modalQty),
            reason: modalReason.trim(),
            condition: modalCondition,
            unitPrice: modalUnitPrice.trim() === '' ? undefined : Number(modalUnitPrice),
          },
        ],
      }, token);
      setAddingProduct(null);
      setShowPicker(false);
      setPickerQuery('');
      reload();
    } finally {
      setAddingItem(false);
    }
  }

  if (!ret) return <p className="text-sm text-muted">{tCommon('loading')}</p>;

  const partyName = ret.customer?.user.fullName ?? ret.manufacturer?.name ?? '';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button onClick={() => router.push(`/${locale}/returns`)} className="mb-1 text-xs text-muted hover:text-ink">
            ← {t('back')}
          </button>
          <h1 className="text-2xl font-bold text-ink">{ret.number ?? t('title')}</h1>
          <p className="text-sm text-muted">
            {ret.type === 'CUSTOMER' ? t('typeCustomer') : t('typeSupplier')} — {partyName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-line/40 px-2 py-1 text-xs text-ink">{t(`status.${ret.status}` as never)}</span>
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`rounded border px-3 py-1.5 text-sm ${editMode ? 'border-accent bg-accent text-white' : 'border-line text-ink hover:bg-line/30'}`}
          >
            {editMode ? t('done') : t('edit')}
          </button>
          <button
            onClick={viewPdf}
            disabled={loadingPdf}
            className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30 disabled:opacity-50"
          >
            {loadingPdf ? tCommon('loading') : t('viewPdf')}
          </button>
          <button onClick={removeReturn} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10">
            {t('delete')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('product')}</th>
              <th className="px-4 py-2 text-end">{t('quantity')}</th>
              <th className="px-4 py-2 text-start">{t('condition')}</th>
              <th className="px-4 py-2 text-start">{t('reason')}</th>
              <th className="px-4 py-2 text-end">{t('unitPrice')}</th>
              <th className="px-4 py-2 text-end">{t('columns.value')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ret.items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="px-4 py-2 text-ink">{item.product.nameFr}</td>
                <td className="px-4 py-2 text-end tabular">{item.quantity}</td>
                <td className="px-4 py-2 text-xs">{t(`conditions.${item.condition}` as never)}</td>
                <td className="px-4 py-2 text-xs text-muted">{item.reason}</td>
                <td className="px-4 py-2 text-end tabular">{Number(item.unitPrice).toLocaleString()} DA</td>
                <td className="px-4 py-2 text-end tabular">{Number(item.lineTotal).toLocaleString()} DA</td>
                <td className="px-4 py-2 text-end">
                  <div className="flex justify-end gap-1">
                    {item.product.images[0] && (
                      <button
                        onClick={() => setViewingItemImages({ images: item.product.images, title: item.product.nameFr })}
                        className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-line/30"
                      >
                        {t('viewPhoto')}
                      </button>
                    )}
                    <button
                      onClick={() => setViewingItemImages({ images: item.images, title: `${item.product.nameFr} — ${t('itemPhotos')}` })}
                      className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-line/30"
                    >
                      {t('itemPhotos')} {item.images.length > 0 ? `(${item.images.length})` : ''}
                    </button>
                    <ImageUploadButton
                      folder="returns"
                      label={t('addItemPhoto')}
                      onUploaded={(url) => addItemImage(item.id, url)}
                      className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-line/30"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editMode && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink"
          >
            + {t('addMoreItems')}
          </button>
          {ret.type === 'SUPPLIER' && <p className="mt-1 text-xs text-muted">{t('supplierProductHint')}</p>}
          {showPicker && (
            <div className="mt-2 rounded border border-line bg-panel p-2">
              <input
                type="search"
                autoFocus
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder={tCommon('search')}
                className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
              />
              <div className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {pickerResults.slice(0, 24).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openAddModal(p)}
                    className="flex flex-col items-center gap-1 rounded border border-line bg-paper p-2 text-center hover:border-accent"
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
      )}

      <div className="ms-auto w-full max-w-xs rounded-lg border border-line bg-panel p-4 text-sm">
        <div className="flex justify-between font-semibold text-ink">
          <span>{t('columns.value')}</span>
          <span className="tabular">{Number(ret.totalValue).toLocaleString()} DA</span>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('notes')}</span>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={t('notesPlaceholder')}
          rows={2}
          className="rounded border border-line bg-paper px-3 py-2 text-ink"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{t('attachments')}</p>
        <div className="flex flex-wrap gap-3">
          {ret.attachments.map((att, index) => (
            <div key={att.id} className="group relative h-20 w-20 overflow-hidden rounded border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.url}
                alt=""
                onClick={() => setLightboxAttachmentIndex(index)}
                className="h-full w-full cursor-zoom-in object-cover"
              />
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute end-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
              >
                ✕
              </button>
            </div>
          ))}
          <ImageUploadButton
            folder="returns"
            label={`+ ${t('addAttachment')}`}
            onUploaded={addAttachment}
            className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-line text-center text-xs text-muted hover:bg-line/20"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {ret.status === 'NEW' && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={decision} onChange={(e) => setDecision(e.target.value)} className="rounded border border-line bg-paper text-ink px-3 py-2 text-sm">
            <option value="">{t('decision')}</option>
            <option value="REFUND">{t('decisions.REFUND')}</option>
            <option value="CREDIT_NOTE">{t('decisions.CREDIT_NOTE')}</option>
            <option value="DEDUCT_NEXT">{t('decisions.DEDUCT_NEXT')}</option>
            <option value="REPLACEMENT">{t('decisions.REPLACEMENT')}</option>
          </select>
          <button onClick={validate} disabled={!decision} className="rounded bg-teal px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {t('validate')}
          </button>
          <button onClick={reject} className="rounded border border-red-300 px-3 py-2 text-sm text-red-600">
            {t('reject')}
          </button>
        </div>
      )}
      {ret.status !== 'NEW' && ret.decision && (
        <p className="text-sm text-ink">
          {t('decision')} : <span className="font-medium">{t(`decisions.${ret.decision}` as never)}</span>
        </p>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">{t('history')}</h2>
          <ul className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel p-3 text-xs">
            {history.map((h) => (
              <li key={h.id} className="border-b border-line/50 pb-1.5 last:border-0 last:pb-0">
                <span className="text-muted">{new Date(h.createdAt).toLocaleString('fr-FR')}</span>
                {' — '}
                <span className="font-medium text-ink">{h.actor?.fullName ?? t('system')}</span>
                {' : '}
                <span className="text-ink">{h.reason ?? `${h.field ?? h.action} → ${h.newValue ?? ''}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lightboxAttachmentIndex !== null && (
        <ImageLightbox
          images={ret.attachments}
          startIndex={lightboxAttachmentIndex}
          title={t('attachments')}
          onClose={() => setLightboxAttachmentIndex(null)}
        />
      )}
      {viewingItemImages && (
        <ImageLightbox images={viewingItemImages.images} title={viewingItemImages.title} onClose={() => setViewingItemImages(null)} />
      )}

      {addingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddingProduct(null)}>
          <div className="w-full max-w-sm rounded-lg bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-semibold text-ink">{addingProduct.nameFr}</p>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted">
                {t('quantity')}
                <input
                  type="number"
                  min={1}
                  value={modalQty}
                  onChange={(e) => setModalQty(e.target.value)}
                  className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-muted">
                {t('condition')}
                <select
                  value={modalCondition}
                  onChange={(e) => setModalCondition(e.target.value as never)}
                  className="mt-1 w-full rounded border border-line bg-paper text-ink px-3 py-2 text-sm"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`conditions.${c}` as never)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                {t('reason')}
                <input
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-muted">
                {t('unitPrice')}
                <input
                  type="number"
                  min={0}
                  value={modalUnitPrice}
                  onChange={(e) => setModalUnitPrice(e.target.value)}
                  placeholder={t('unitPriceHint')}
                  className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAddingProduct(null)} className="rounded border border-line px-3 py-2 text-sm text-ink">
                {tCommon('cancel')}
              </button>
              <button
                onClick={confirmAddItem}
                disabled={!modalReason.trim() || Number(modalQty) < 1 || addingItem}
                className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t('addItem')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
