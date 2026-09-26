'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { ImageLightbox } from '@/components/image-lightbox';
import { ImageUploadButton } from '@/components/image-upload-button';
import { SortSelect, type SortMode } from '@/components/sort-select';
import { BarcodeScanButton } from '@/components/barcode-scanner';
import { openOrSharePdf, supportsPdfShare } from '@/lib/pdf-share';

interface Price {
  tierKey: string;
  label: string;
  price: number;
}
interface PickerProduct {
  id: string;
  sku: string;
  barcode: string | null;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  category: { id: string; nameFr: string; nameAr: string | null; nameEn: string | null };
  packagingUnit: { label: string };
  unitsPerPackage: number;
  images: { url: string }[];
  availability: 'IN_STOCK' | 'OUT_OF_STOCK';
  prices: Price[];
}
interface VoucherItem {
  id: string;
  product: { id: string; nameFr: string; depot: string | null; images: { url: string }[] };
  packagingUnit: { label: string };
  quantityPackages: number;
  unitsPerPackageSnapshot: number;
  totalUnits: number;
  actualTotalUnits: number | null;
  unitPrice: string;
  lineTotal: string;
  isLoaded: boolean;
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
  loadedById: string | null;
  depot: string | null;
  items: VoucherItem[];
  attachments: { id: string; url: string; createdAt: string }[];
  pendingDeletions: { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reason: string }[];
}
interface StaffOption {
  id: string;
  fullName: string;
}
interface DeliveryInfo {
  id: string;
  driverId: string | null;
  driverName: string | null;
  cost: string;
  billedToCustomer: string;
  status: string;
}
interface DriverOption {
  id: string;
  fullName: string;
}

const localizedName = (item: { nameFr: string; nameAr?: string | null; nameEn?: string | null }, locale: string) => {
  if (locale === 'ar' && item.nameAr) return item.nameAr;
  if (locale === 'en' && item.nameEn) return item.nameEn;
  return item.nameFr;
};

// Champs numériques en type="text" + inputMode plutôt que type="number" : les
// inputs number contrôlés perdent des frappes sur mobile — bug connu de
// React + Android/iOS avec value contrôlée. Texte + filtrage manuel = fiable.
const onlyDigits = (v: string) => v.replace(/[^0-9]/g, '');
const onlyDecimal = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

export default function VoucherEditorPage() {
  const t = useTranslations('vouchers');
  const tCatalog = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tTransport = useTranslations('transport');
  const { token, hasPermission } = useAuth();
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();
  const canManage = hasPermission('vouchers.create');
  const canSeeStock = hasPermission('stock.manage');
  const basePath = canManage ? '/vouchers' : '/vouchers/mine';

  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [discount, setDiscount] = useState('0');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [transportCost, setTransportCost] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Record<string, unknown>>({});

  // Sélecteur de produit : recherche + vignettes + zoom, même système que le Catalogue.
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<PickerProduct[]>([]);
  const [viewTier, setViewTier] = useState('');
  const [lightboxProduct, setLightboxProduct] = useState<PickerProduct | null>(null);
  const [addingProduct, setAddingProduct] = useState<PickerProduct | null>(null);
  const [modalQty, setModalQty] = useState('1');
  const [modalUnitsPerPackage, setModalUnitsPerPackage] = useState('');
  const [modalPieces, setModalPieces] = useState('');
  const [modalMissingPieces, setModalMissingPieces] = useState('0');
  const [modalUnitPrice, setModalUnitPrice] = useState('');
  const [modalDiscount, setModalDiscount] = useState('0');
  const [modalDiscountPercent, setModalDiscountPercent] = useState('0');
  const [lightboxAttachmentIndex, setLightboxAttachmentIndex] = useState<number | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemSort, setItemSort] = useState<SortMode>('manual');
  const [viewingItemImages, setViewingItemImages] = useState<{ images: { url: string }[]; title: string } | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [delivery, setDelivery] = useState<DeliveryInfo | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryDriverId, setDeliveryDriverId] = useState('');
  const [deliveryCost, setDeliveryCost] = useState('');
  const [deliveryBilledToCustomer, setDeliveryBilledToCustomer] = useState('');

  async function viewPdf() {
    // Sur mobile (partage de fichier supporté), on n'ouvre pas d'onglet —
    // la feuille de partage native s'occupe de tout. Sur desktop, on ouvre
    // un onglet vide tout de suite (synchrone, sinon les bloqueurs de popup
    // l'empêchent une fois passé le premier "await") puis on le redirige
    // vers le PDF une fois prêt.
    const win = supportsPdfShare() ? null : window.open('', '_blank');
    setLoadingPdf(true);
    try {
      await openOrSharePdf(() => api.getBlob(`/vouchers/${id}/pdf`, token), `${voucher?.number ?? 'bon'}.pdf`, win);
    } catch {
      win?.close();
      setError(tCommon('error'));
    } finally {
      setLoadingPdf(false);
    }
  }

  function reload() {
    api.get<Voucher>(`${basePath}/${id}`, token).then((v) => {
      setVoucher(v);
      setDiscount(v.discount);
      const sub = v.items.reduce((s, i) => s + Number(i.lineTotal), 0);
      setDiscountPercent(sub > 0 ? String(Math.round((Number(v.discount) / sub) * 10000) / 100) : '0');
      setTransportCost(v.transportCost);
      setPaidAmount(v.paidAmount);
      setNotes(v.notes ?? '');
    });
    if (canManage) api.get<HistoryEntry[]>(`/vouchers/${id}/history`, token).then(setHistory).catch(() => setHistory([]));
    if (canManage) api.get<DeliveryInfo | null>(`/deliveries/voucher/${id}`, token).then(setDelivery).catch(() => setDelivery(null));
  }

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  useEffect(() => {
    if (token && canManage) api.get<StaffOption[]>('/vouchers/staff', token).then(setStaff).catch(() => setStaff([]));
    if (token && canManage) api.get<DriverOption[]>('/drivers', token).then(setDrivers).catch(() => setDrivers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canManage]);

  async function saveDelivery() {
    await api.put(`/deliveries/voucher/${id}`, {
      driverId: deliveryDriverId || undefined,
      cost: deliveryCost === '' ? undefined : Number(deliveryCost),
      billedToCustomer: deliveryBilledToCustomer === '' ? undefined : Number(deliveryBilledToCustomer),
    }, token);
    setShowDeliveryForm(false);
    reload();
  }
  async function cancelDelivery() {
    if (!delivery || !window.confirm(t('removeDeliveryConfirm'))) return;
    await api.post(`/deliveries/${delivery.id}/cancel`, {}, token);
    reload();
  }

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

  const availableTiers = Array.from(
    new Map(pickerResults.flatMap((p) => p.prices.map((pr) => [pr.tierKey, pr.label] as const))).entries(),
  ).map(([tierKey, label]) => ({ tierKey, label }));

  useEffect(() => {
    if (availableTiers.length === 0) return;
    if (!availableTiers.some((tr) => tr.tierKey === viewTier)) {
      const preferred = ['wholesale', 'retail'].find((key) => availableTiers.some((tr) => tr.tierKey === key));
      setViewTier(preferred ?? availableTiers[0].tierKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTiers]);

  function priceForView(p: PickerProduct): Price | undefined {
    if (viewTier) return p.prices.find((pr) => pr.tierKey === viewTier) ?? p.prices[0];
    return p.prices[0];
  }

  const isDraft = voucher?.status === 'DRAFT';
  // "Modifier" ouvre l'édition d'un bon déjà confirmé/livré : le backend
  // ajuste alors le stock du delta exact et journalise chaque changement.
  const canReopen = canManage && (voucher?.status === 'CONFIRMED' || voucher?.status === 'DELIVERED');
  const editable = isDraft || editMode;
  const voucherDeletion = voucher?.pendingDeletions[0];

  // Ne recharge PAS ces 4 champs après un enregistrement automatique — ils
  // sont déjà exacts localement (c'est justement ce qu'on vient d'envoyer).
  // Les réécraser avec la réponse du serveur créait une course : si
  // l'utilisateur retapait un chiffre pendant que ce fetch était en vol, sa
  // frappe se faisait écraser par l'ancienne valeur au retour — d'où les
  // chiffres qui "disparaissent et reviennent" en tapant vite. On ne
  // rafraîchit voucher/discountPercent que si des articles ont changé.
  function refreshVoucherOnly() {
    api.get<Voucher>(`${basePath}/${id}`, token).then((v) => {
      setVoucher(v);
      const sub = v.items.reduce((s, i) => s + Number(i.lineTotal), 0);
      setDiscountPercent(sub > 0 ? String(Math.round((Number(v.discount) / sub) * 10000) / 100) : '0');
    });
  }

  const autoSave = useCallback(
    (patch: Record<string, unknown>) => {
      // Fusionne avec un éventuel changement déjà en attente — sinon,
      // modifier un champ puis un autre avant la fin du délai perdait le
      // premier (un seul minuteur partagé remplaçait le patch précédent).
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const toSend = pendingPatchRef.current;
        pendingPatchRef.current = {};
        try {
          await api.put(`${basePath}/${id}`, toSend, token);
          setSavedAt(new Date());
          if ('items' in toSend) refreshVoucherOnly();
        } catch (e) {
          const details = e instanceof ApiError ? (e.details as { code?: string; shortfalls?: { name: string; available: number; requested: number }[] } | undefined) : undefined;
          if (details?.code === 'INSUFFICIENT_STOCK' && details.shortfalls && 'items' in toSend) {
            const lines = details.shortfalls.map((s) => `${s.name} : ${t('stockAvailable')} ${s.available}, ${t('stockRequested')} ${s.requested}`).join('\n');
            if (window.confirm(`${t('insufficientStockConfirm')}\n\n${lines}`)) {
              try {
                await api.put(`${basePath}/${id}`, { ...toSend, force: true }, token);
                setSavedAt(new Date());
              } catch {
                setError(tCommon('error'));
              }
            }
            // Que la modification forcée réussisse ou soit refusée, on
            // resynchronise l'affichage sur l'état réel du serveur.
            refreshVoucherOnly();
            return;
          }
          setError(tCommon('error'));
        }
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, token, basePath],
  );

  function openAddModal(p: PickerProduct) {
    const price = priceForView(p)?.price ?? 0;
    setAddingProduct(p);
    setModalQty('1');
    setModalUnitsPerPackage(String(p.unitsPerPackage));
    setModalPieces(String(p.unitsPerPackage));
    setModalMissingPieces('0');
    setModalUnitPrice(String(price));
    setModalDiscount('0');
    setModalDiscountPercent('0');
  }

  // Scan caméra : cherche une correspondance exacte (SKU ou code-barres) et
  // ouvre directement la fenêtre d'ajout — sinon retombe sur la recherche
  // texte classique du sélecteur avec le code scanné.
  async function handleBarcodeScan(code: string) {
    setShowPicker(true);
    try {
      const res = await api.get<{ items: PickerProduct[] }>(`/products?search=${encodeURIComponent(code)}&pageSize=5`, token);
      const exact = res.items.find((p) => p.sku === code || p.barcode === code);
      if (exact) {
        openAddModal(exact);
        return;
      }
    } catch {
      // on retombe sur la recherche texte ci-dessous
    }
    setPickerQuery(code);
  }

  /** Sous-total plein (cartons catalogue × prix catalogue) — base de calcul du %. */
  function modalStandard(): number {
    if (!addingProduct) return 0;
    const catalogPrice = priceForView(addingProduct)?.price ?? 0;
    const pieces = Math.max(0, Number(modalPieces) || 0);
    return pieces * catalogPrice;
  }

  function onModalDiscountChange(v: string) {
    const clean = onlyDecimal(v);
    setModalDiscount(clean);
    const standard = modalStandard();
    setModalDiscountPercent(standard > 0 ? String(Math.round(((Number(clean) || 0) / standard) * 10000) / 100) : '0');
  }

  function onModalDiscountPercentChange(v: string) {
    const clean = onlyDecimal(v);
    setModalDiscountPercent(clean);
    const standard = modalStandard();
    const pct = Math.max(0, Number(clean) || 0);
    setModalDiscount(String(Math.round(standard * (pct / 100) * 100) / 100));
  }

  /** Sous-total du bon (avant remise/transport) — base de calcul de la remise en %. */
  function voucherSubtotal(): number {
    if (!voucher) return 0;
    return voucher.items.reduce((s, i) => s + Number(i.lineTotal), 0);
  }

  function onDiscountChange(v: string) {
    const clean = onlyDecimal(v);
    setDiscount(clean);
    const sub = voucherSubtotal();
    setDiscountPercent(sub > 0 ? String(Math.round(((Number(clean) || 0) / sub) * 10000) / 100) : '0');
    autoSave({ discount: Number(clean) || 0 });
  }

  function onDiscountPercentChange(v: string) {
    const clean = onlyDecimal(v);
    setDiscountPercent(clean);
    const sub = voucherSubtotal();
    const pct = Math.max(0, Number(clean) || 0);
    const amt = Math.round(sub * (pct / 100) * 100) / 100;
    setDiscount(String(amt));
    autoSave({ discount: amt });
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

  // Champ dédié "Pièces manquantes" : évite au vendeur de calculer le total
  // réel de tête (8 cartons de 100 dont un incomplet de 4 → il tape juste 4).
  function onModalMissingPiecesChange(v: string) {
    const clean = onlyDigits(v);
    setModalMissingPieces(clean);
    if (!addingProduct) return;
    const qty = Math.max(0, Number(modalQty) || 0);
    const upp = Number(modalUnitsPerPackage) > 0 ? Number(modalUnitsPerPackage) : addingProduct.unitsPerPackage;
    const missing = Math.max(0, Number(clean) || 0);
    setModalPieces(String(Math.max(0, qty * upp - missing)));
  }

  // La quantité (cartons) facturée/déduite du stock doit toujours dériver
  // du conditionnement catalogue (fixe), jamais du champ "Pièces / carton"
  // ci-dessus : celui-ci est éditable/effaçable par l'utilisateur pour noter
  // un carton reçu incomplet, mais s'il est vide ou différent, on ne doit
  // jamais perdre le nombre de pièces réellement tapé ici — sinon la
  // quantité retombe silencieusement sur 1 carton par défaut à la confirmation.
  function onModalPiecesChange(v: string) {
    const clean = onlyDigits(v);
    setModalPieces(clean);
    if (!addingProduct) return;
    const pieces = Math.max(0, Number(clean) || 0);
    const qty = Math.max(1, Math.ceil(pieces / addingProduct.unitsPerPackage));
    setModalQty(String(qty));
    setModalMissingPieces(String(Math.max(0, qty * addingProduct.unitsPerPackage - pieces)));
  }

  // Suggère automatiquement une remise = écart entre le prix catalogue plein
  // et le prix unitaire que le vendeur indique réellement facturer. Le nombre
  // de pièces réel est désormais facturé tel quel (actualTotalUnits) — la
  // remise ne compense donc plus que l'écart de PRIX, pas l'écart de
  // quantité. Reste modifiable manuellement.
  useEffect(() => {
    if (!addingProduct) return;
    const catalogPrice = priceForView(addingProduct)?.price ?? 0;
    const pieces = Math.max(0, Number(modalPieces) || 0);
    const unitPrice = Math.max(0, Number(modalUnitPrice) || 0);
    const standard = pieces * catalogPrice;
    const actual = pieces * unitPrice;
    const suggested = Math.max(0, Math.round((standard - actual) * 100) / 100);
    setModalDiscount(String(suggested));
    setModalDiscountPercent(standard > 0 ? String(Math.round((suggested / standard) * 10000) / 100) : '0');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalPieces, modalUnitPrice, addingProduct]);

  // Le nombre de pièces réel tapé par le vendeur est désormais envoyé tel
  // quel au bon (actualTotalUnits) : la colonne Quantité affiche ce chiffre
  // directement (ex: 796) au lieu du nominal cartons×catalogue (8×100=800).
  // La remise ne sert plus qu'à compenser un écart de PRIX unitaire, pas de
  // quantité — elle reste traçable dans les observations avec le marqueur ⚠.
  function confirmAddToVoucher() {
    if (!voucher || !addingProduct) return;
    const qty = Math.max(1, Number(modalQty) || 1);
    const discountAmt = Math.max(0, Number(modalDiscount) || 0);
    const pieces = Math.max(0, Number(modalPieces) || 0);
    const nominalUnits = qty * addingProduct.unitsPerPackage;
    const hasCustomPieces = pieces > 0 && pieces !== nominalUnits;
    const addedUnits = hasCustomPieces ? pieces : nominalUnits;

    const existingItems = voucher.items.map((i) => ({
      productId: i.product.id,
      quantityPackages: i.quantityPackages,
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
              actualTotalUnits: mergedUnits !== mergedQty * addingProduct.unitsPerPackage ? mergedUnits : undefined,
            };
          })
        : [...existingItems, { productId: addingProduct.id, quantityPackages: qty, actualTotalUnits: hasCustomPieces ? pieces : undefined }];
    const newDiscount = Math.round((Number(discount) + discountAmt) * 100) / 100;

    let newNotes = notes;
    if (hasCustomPieces || discountAmt > 0) {
      const prefix = `⚠ ${tCatalog('adjustedWarning')} : `;
      const qtyDetail = hasCustomPieces
        ? `${pieces} ${tCatalog('pieces')} (${qty} × ${addingProduct.unitsPerPackage})`
        : `${pieces} ${tCatalog('pieces')}`;
      const discountDetail = discountAmt > 0 ? ` — remise ${discountAmt.toLocaleString()} DA` : '';
      const line = `${localizedName(addingProduct, locale)} : ${qtyDetail}${discountDetail}`;
      newNotes = notes.startsWith(prefix) ? `${notes} | ${line}` : notes ? `${notes} | ${prefix}${line}` : `${prefix}${line}`;
    }

    setDiscount(String(newDiscount));
    // Pourcentage approximatif (sous-total avant ajout) — recalculé
    // précisément par reload() une fois le nouveau total connu côté serveur.
    const subBefore = voucherSubtotal();
    setDiscountPercent(subBefore > 0 ? String(Math.round((newDiscount / subBefore) * 10000) / 100) : '0');
    setNotes(newNotes);
    autoSave({ items: newItems, discount: newDiscount, notes: newNotes || undefined });
    setAddingProduct(null);
    setPickerQuery('');
  }

  function removeItem(productId: string) {
    if (!voucher) return;
    const items = voucher.items
      .filter((i) => i.product.id !== productId)
      .map((i) => ({ productId: i.product.id, quantityPackages: i.quantityPackages, actualTotalUnits: i.actualTotalUnits ?? undefined }));
    autoSave({ items });
  }

  async function addAttachment(url: string) {
    setUploadingAttachment(true);
    try {
      await api.post(`${basePath}/${id}/attachments`, { url }, token);
      reload();
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!window.confirm(t('deleteAttachmentConfirm'))) return;
    await api.delete(`${basePath}/${id}/attachments/${attachmentId}`, token);
    reload();
  }

  async function setLoadedBy(loadedById: string) {
    await api.put(`/vouchers/${id}/loaded-by`, { loadedById: loadedById || undefined }, token);
    reload();
  }

  async function toggleItemLoaded(item: VoucherItem) {
    if (!item.isLoaded && !window.confirm(t('confirmLoadItem'))) return;
    await api.put(`/vouchers/${id}/items/${item.id}/loaded`, { loaded: !item.isLoaded }, token);
    reload();
  }

  async function confirmVoucher(force = false) {
    setError(null);
    try {
      await api.post(`/vouchers/${id}/confirm`, force ? { force: true } : undefined, token);
      reload();
    } catch (e) {
      const details = e instanceof ApiError ? (e.details as { code?: string; shortfalls?: { name: string; available: number; requested: number }[] } | undefined) : undefined;
      if (details?.code === 'INSUFFICIENT_STOCK' && details.shortfalls) {
        const lines = details.shortfalls.map((s) => `${s.name} : ${t('stockAvailable')} ${s.available}, ${t('stockRequested')} ${s.requested}`).join('\n');
        if (window.confirm(`${t('insufficientStockConfirm')}\n\n${lines}`)) {
          await confirmVoucher(true);
          return;
        }
        return;
      }
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

  async function revertCancelVoucher() {
    if (!window.confirm(t('revertCancelConfirm'))) return;
    await api.post(`/vouchers/${id}/revert-cancel`, undefined, token);
    reload();
  }

  // La suppression du bon n'efface rien tout de suite : elle attend
  // l'approbation du client, et le bon reste affiché (barré) pour de bon.
  async function requestVoucherDeletion() {
    const reason = window.prompt(t('deleteReasonPrompt'));
    if (!reason) return;
    await api.post(`/vouchers/${id}/request-deletion`, { reason }, token);
    reload();
  }

  if (!voucher) return <p className="text-muted">{tCommon('loading')}</p>;

  // Tolère un back-end pas encore redéployé (nouvelle migration Render en
  // attente de déploiement manuel) où ce champ n'existe pas encore.
  const attachments = voucher.attachments ?? [];

  const subtotal = voucher.items.reduce((s, i) => s + Number(i.lineTotal), 0);
  const total = subtotal - Number(discount) + Number(transportCost);

  const itemSearchQuery = itemSearch.trim().toLowerCase();
  const filteredItems = itemSearchQuery
    ? voucher.items.filter((i) => i.product.nameFr.toLowerCase().includes(itemSearchQuery))
    : voucher.items;

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (itemSort) {
      case 'name_asc':
        return a.product.nameFr.localeCompare(b.product.nameFr);
      case 'name_desc':
        return b.product.nameFr.localeCompare(a.product.nameFr);
      case 'price_asc':
        return Number(a.unitPrice) - Number(b.unitPrice);
      case 'price_desc':
        return Number(b.unitPrice) - Number(a.unitPrice);
      case 'qty_asc':
        return (a.actualTotalUnits ?? a.totalUnits) - (b.actualTotalUnits ?? b.totalUnits);
      case 'qty_desc':
        return (b.actualTotalUnits ?? b.totalUnits) - (a.actualTotalUnits ?? a.totalUnits);
      case 'depot_asc':
        return (a.product.depot ?? '').localeCompare(b.product.depot ?? '');
      case 'depot_desc':
        return (b.product.depot ?? '').localeCompare(a.product.depot ?? '');
      default:
        return 0;
    }
  });

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
          {editable && savedAt && <span className="text-xs text-muted">{t('autoSaved')} {savedAt.toLocaleTimeString()}</span>}
          {canReopen && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`rounded border px-3 py-1.5 text-sm ${editMode ? 'border-teal bg-teal/10 text-teal' : 'border-line text-ink hover:bg-line/30'}`}
            >
              {editMode ? tCommon('done') : t('modify')}
            </button>
          )}
          {canManage && (
            <button
              onClick={viewPdf}
              disabled={loadingPdf}
              className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30 disabled:opacity-50"
            >
              {loadingPdf ? tCommon('loading') : t('viewPdf')}
            </button>
          )}
          {canManage && voucherDeletion?.status !== 'PENDING' && voucherDeletion?.status !== 'APPROVED' && (
            <button onClick={requestVoucherDeletion} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              {t('deleteVoucher')}
            </button>
          )}
        </div>
      </div>

      {voucherDeletion && (voucherDeletion.status === 'PENDING' || voucherDeletion.status === 'APPROVED') && (
        <p className={`rounded border px-3 py-2 text-xs ${voucherDeletion.status === 'APPROVED' ? 'border-red-300 bg-red-50 text-red-600' : 'border-amber-400 bg-amber-500/10 text-amber-700'}`}>
          {voucherDeletion.status === 'APPROVED' ? t('detailDeleted') : t('detailPendingDeletion')} : {voucherDeletion.reason}
        </p>
      )}

      {editMode && (
        <p className="rounded border border-teal/40 bg-teal/10 px-3 py-2 text-xs text-teal">{t('editModeWarning')}</p>
      )}

      {editable && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="w-fit rounded bg-accent px-3 py-2 text-sm font-medium text-white"
            >
              {showPicker ? tCommon('cancel') : t('addProduct')}
            </button>
            <BarcodeScanButton onScan={handleBarcodeScan} />
          </div>

          {showPicker && (
            <div className="rounded-lg border border-line bg-panel p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={tCommon('search')}
                  className="min-w-0 flex-1 rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
                />
                {availableTiers.length > 1 && (
                  <select
                    value={viewTier}
                    onChange={(e) => setViewTier(e.target.value)}
                    className="rounded border border-line bg-paper px-2 py-2 text-sm"
                  >
                    {availableTiers.map((tr) => (
                      <option key={tr.tierKey} value={tr.tierKey}>
                        {tCatalog('viewPricesAs')}: {tr.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 4 colonnes × 2 lignes visibles (8 produits) ; le reste se découvre
                  en faisant défiler horizontalement, pas verticalement. */}
              <div className="mt-3">
                {pickerResults.length === 0 && <p className="py-4 text-center text-xs text-muted">{tCatalog('noResults')}</p>}
                <div className="grid grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-2" style={{ gridAutoColumns: '5.5rem' }}>
                  {pickerResults.map((p) => {
                    const price = priceForView(p);
                    return (
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
                        <p className="line-clamp-2 w-full text-[11px] font-medium leading-tight text-ink">
                          {localizedName(p, locale)}
                        </p>
                        {price ? (
                          <span className="font-mono text-[11px] font-semibold text-ink">{price.price} DA</span>
                        ) : (
                          <span className="text-[10px] text-muted">—</span>
                        )}
                        {p.availability !== 'IN_STOCK' && <p className="text-[9px] text-red-600">{tCatalog('outOfStock')}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-4">
          <label className="flex w-fit flex-col gap-1 text-sm">
            <span className="text-muted">{t('loadedBy')}</span>
            <select
              value={voucher.loadedById ?? ''}
              onChange={(e) => setLoadedBy(e.target.value)}
              className="rounded border border-line bg-panel px-3 py-2"
            >
              <option value="">{t('notAssigned')}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          placeholder={t('itemSearchPlaceholder')}
          className="w-full max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <SortSelect
          value={itemSort}
          onChange={setItemSort}
          options={['manual', 'name_asc', 'name_desc', 'price_desc', 'price_asc', 'qty_desc', 'qty_asc', 'depot_asc', 'depot_desc']}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start"></th>
              <th className="px-4 py-2 text-start">{t('product')}</th>
              <th className="px-4 py-2 text-start">{t('quantity')}</th>
              <th className="px-4 py-2 text-start">{t('unitPrice')}</th>
              <th className="px-4 py-2 text-end">{t('total')}</th>
              {canManage && <th className="px-4 py-2 text-center">{t('loaded')}</th>}
              {editable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => {
              const itemImages = item.product.images ?? [];
              return (
              <tr key={item.id} className={`border-t border-line ${item.modifiedAt ? 'bg-amber-500/10' : ''}`}>
                <td className="px-2 py-2">
                  {itemImages.length > 0 && (
                    <button
                      type="button"
                      title={t('viewPhoto')}
                      onClick={() => setViewingItemImages({ images: itemImages, title: item.product.nameFr })}
                      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded border border-line hover:opacity-80"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={itemImages[0].url} alt="" className="h-full w-full object-cover" />
                    </button>
                  )}
                </td>
                <td className="px-4 py-2 text-ink">{item.product.nameFr}</td>
                <td className="px-4 py-2 text-xs text-muted">
                  {item.quantityPackages} {item.packagingUnit.label} × {item.unitsPerPackageSnapshot} = {item.totalUnits} {t('pieces')}
                  {item.actualTotalUnits != null && item.actualTotalUnits !== item.totalUnits && (
                    <span className="text-amber-600">
                      {' '}
                      ({tCatalog('minus')} {item.totalUnits - item.actualTotalUnits} {t('pieces')} = {item.actualTotalUnits} {t('pieces')})
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 tabular">{item.unitPrice} DA</td>
                <td className="px-4 py-2 text-end tabular">{item.lineTotal} DA</td>
                {canManage && (
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={item.isLoaded}
                      onChange={() => toggleItemLoaded(item)}
                      className="h-4 w-4 accent-teal"
                    />
                  </td>
                )}
                {editable && (
                  <td className="px-2 py-2 text-end">
                    <button onClick={() => removeItem(item.product.id)} className="text-xs text-red-600 hover:underline">
                      {t('removeItem')}
                    </button>
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t('discount')}</span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              value={discountPercent}
              disabled={!editable}
              onChange={(e) => onDiscountPercentChange(e.target.value)}
              className="w-0 min-w-0 flex-1 rounded border border-line bg-panel px-2 py-2 text-end disabled:opacity-60"
            />
            <span className="text-xs text-muted">%</span>
            <input
              type="text"
              inputMode="decimal"
              value={discount}
              disabled={!editable}
              onChange={(e) => onDiscountChange(e.target.value)}
              className="w-0 min-w-0 flex-1 rounded border border-line bg-panel px-2 py-2 text-end disabled:opacity-60"
            />
            <span className="text-xs text-muted">DA</span>
          </div>
        </label>
        <NumField label={t('transport')} value={transportCost} disabled={!editable} onChange={(v) => { setTransportCost(v); autoSave({ transportCost: Number(v) }); }} />
        <NumField label={t('paidAmount')} value={paidAmount} disabled={!editable} onChange={(v) => { setPaidAmount(v); autoSave({ paidAmount: Number(v) }); }} />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('notes')}</span>
        <textarea
          value={notes}
          disabled={!editable}
          onChange={(e) => { setNotes(e.target.value); autoSave({ notes: e.target.value }); }}
          rows={2}
          className={`rounded border px-3 py-2 ${
            notes.includes('⚠') ? 'border-amber-500 bg-amber-500/10 text-amber-700' : 'border-line bg-panel'
          }`}
        />
      </label>

      {canManage && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="mb-2 text-sm font-semibold text-ink">{t('delivery')}</p>
          {delivery && delivery.status !== 'CANCELLED' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-ink">
                {delivery.driverName ?? t('noDriverAssigned')} — {tTransport('billedToCustomer')}: {Number(delivery.billedToCustomer).toLocaleString()} DA — {tTransport(`status.${delivery.status}` as never)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeliveryDriverId(delivery.driverId ?? ''); setDeliveryCost(delivery.cost); setDeliveryBilledToCustomer(delivery.billedToCustomer); setShowDeliveryForm(true); }}
                  className="text-xs text-accent hover:underline"
                >
                  {tCommon('edit')}
                </button>
                <button onClick={cancelDelivery} className="text-xs text-red-600 hover:underline">
                  {t('removeDelivery')}
                </button>
              </div>
            </div>
          ) : (
            !showDeliveryForm && (
              <button
                onClick={() => { setDeliveryDriverId(''); setDeliveryCost(''); setDeliveryBilledToCustomer(''); setShowDeliveryForm(true); }}
                className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30"
              >
                + {t('assignDriver')}
              </button>
            )
          )}
          {showDeliveryForm && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted">{t('driver')}</span>
                <select
                  value={deliveryDriverId}
                  onChange={(e) => setDeliveryDriverId(e.target.value)}
                  className="rounded border border-line bg-paper px-2 py-1.5 text-sm text-ink"
                >
                  <option value="">—</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted">{t('deliveryCost')}</span>
                <input
                  type="number"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(e.target.value)}
                  className="w-28 rounded border border-line bg-paper px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted">{tTransport('billedToCustomer')}</span>
                <input
                  type="number"
                  value={deliveryBilledToCustomer}
                  onChange={(e) => setDeliveryBilledToCustomer(e.target.value)}
                  className="w-28 rounded border border-line bg-paper px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <button onClick={saveDelivery} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">{tCommon('save')}</button>
              <button onClick={() => setShowDeliveryForm(false)} className="rounded border border-line px-3 py-1.5 text-sm text-ink">{tCommon('cancel')}</button>
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted">{t('deliveryHint')}</p>
        </div>
      )}

      <div className="ms-auto w-full max-w-xs rounded-lg border border-line bg-panel p-4 text-sm">
        <Row label={t('subtotal')} value={subtotal} />
        {Number(discount) > 0 && <Row label={`${t('discount')} (${discountPercent} %)`} value={-Number(discount)} />}
        <Row label={t('total')} value={total} bold />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{t('attachments')}</p>
        <div className="flex flex-wrap gap-3">
          {attachments.map((att, index) => (
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
            folder="vouchers"
            label={uploadingAttachment ? '…' : `+ ${t('addAttachment')}`}
            onUploaded={addAttachment}
            className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-line text-center text-xs text-muted hover:bg-line/20"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isDraft && canManage && (
        <div>
          <p className="mb-2 text-xs text-muted">{t('confirmWarning')}</p>
          <button onClick={() => confirmVoucher()} className="rounded bg-teal px-4 py-2 text-sm font-medium text-white">
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
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-600">{voucher.cancelReason}</p>
          {canManage && (
            <button onClick={revertCancelVoucher} className="rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30">
              {t('revertCancel')}
            </button>
          )}
        </div>
      )}

      {canManage && history.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">{t('history')}</h2>
          <ul className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel p-3 text-xs">
            {history.map((h) => (
              <li key={h.id} className="border-b border-line/50 pb-1.5 last:border-0 last:pb-0">
                <span className="text-muted">{new Date(h.createdAt).toLocaleString('fr-FR')}</span>
                {' — '}
                <span className="font-medium text-ink">{h.actor?.fullName ?? t('system')}</span>
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
              <span className="text-muted">{tCatalog('unitPrice')}</span>
              <input
                type="text"
                inputMode="decimal"
                value={modalUnitPrice}
                onChange={(e) => setModalUnitPrice(onlyDecimal(e.target.value))}
                className="rounded border border-line bg-paper px-3 py-2"
              />
            </label>

            {(() => {
              const catalogPrice = priceForView(addingProduct)?.price;
              const discountAmt = Math.max(0, Number(modalDiscount) || 0);
              const standard = catalogPrice != null ? modalStandard() : undefined;
              const actual = Math.max(0, Number(modalPieces) || 0) * Math.max(0, Number(modalUnitPrice) || 0);
              const lineTotal = standard != null ? Math.max(0, standard - discountAmt) : actual;
              return (
                <div className="mt-3 flex flex-col gap-1.5 text-sm">
                  {standard != null && <ModalRow label={tCatalog('subtotal')} value={`${standard.toLocaleString()} DA`} />}
                  <div className="flex items-center justify-between gap-2 text-muted">
                    <span>{tCatalog('discount')}</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={modalDiscountPercent}
                        onChange={(e) => onModalDiscountPercentChange(e.target.value)}
                        className="w-16 rounded border border-line bg-paper px-2 py-1 text-end text-ink"
                      />
                      <span className="text-xs">%</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={modalDiscount}
                        onChange={(e) => onModalDiscountChange(e.target.value)}
                        className="w-20 rounded border border-line bg-paper px-2 py-1 text-end text-ink"
                      />
                      <span className="text-xs">DA</span>
                    </div>
                  </div>
                  <ModalRow label={tCatalog('total')} value={`${lineTotal.toLocaleString()} DA`} bold />
                </div>
              );
            })()}

            <button onClick={confirmAddToVoucher} className="mt-4 w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white">
              {tCatalog('confirmAdd')}
            </button>
          </div>
        </div>
      )}

      {lightboxProduct && (
        <ImageLightbox
          images={lightboxProduct.images}
          title={localizedName(lightboxProduct, locale)}
          onClose={() => setLightboxProduct(null)}
        />
      )}

      {lightboxAttachmentIndex !== null && (
        <ImageLightbox
          images={attachments}
          startIndex={lightboxAttachmentIndex}
          title={t('attachments')}
          onClose={() => setLightboxAttachmentIndex(null)}
        />
      )}

      {viewingItemImages && (
        <ImageLightbox
          images={viewingItemImages.images}
          title={viewingItemImages.title}
          onClose={() => setViewingItemImages(null)}
        />
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

function ModalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-ink' : 'text-muted'}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
