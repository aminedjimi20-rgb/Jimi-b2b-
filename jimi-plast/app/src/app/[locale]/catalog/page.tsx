'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { cart, useCarts } from '@/lib/cart';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ImageLightbox } from '@/components/image-lightbox';

interface Category {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  parentId: string | null;
}

interface Price {
  tierKey: string;
  label: string;
  price: number;
  originalPrice?: number;
  hasPromotion: boolean;
}

interface CategoryRef {
  id: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  parent?: { id: string; nameFr: string; nameAr: string | null; nameEn: string | null } | null;
}

interface Product {
  id: string;
  sku: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  brand: string | null;
  category: CategoryRef;
  packagingUnit: { label: string; labelPlural: string };
  unitsPerPackage: number;
  costPrice: number | null;
  images: { url: string; isPrimary: boolean }[];
  isNew: boolean;
  isFeatured: boolean;
  availability: 'IN_STOCK' | 'OUT_OF_STOCK';
  currentStock: number | null;
  prices: Price[];
  hasPromotion: boolean;
}

interface CustomerOption {
  id: string;
  user: { fullName: string };
}

interface DraftVoucher {
  id: string;
  notes: string | null;
  items: { product: { id: string }; quantityPackages: number }[];
}

const localizedName = (item: { nameFr: string; nameAr?: string | null; nameEn?: string | null }, locale: string) => {
  if (locale === 'ar' && item.nameAr) return item.nameAr;
  if (locale === 'en' && item.nameEn) return item.nameEn;
  return item.nameFr;
};

// Champs numériques en type="text" + inputMode plutôt que type="number" : les
// inputs number contrôlés perdent des frappes sur mobile (le "0" par défaut,
// puis les chiffres suivants, disparaissent en tapant vite) — bug connu de
// React + Android/iOS avec value contrôlée. Texte + filtrage manuel = fiable.
const onlyDigits = (v: string) => v.replace(/[^0-9]/g, '');
const onlyDecimal = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

export default function CatalogPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const { user, token, hasPermission } = useAuth();
  const { sessions, activeId } = useCarts();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogIndex, setCatalogIndex] = useState<Map<string, Product>>(new Map());
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState('priority');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyOnSale, setOnlyOnSale] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);

  const [showCart, setShowCart] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [pickingCustomer, setPickingCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lightboxProduct, setLightboxProduct] = useState<Product | null>(null);
  const [viewTier, setViewTier] = useState('');
  const [addingProduct, setAddingProduct] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState('1');
  const [modalUnitsPerPackage, setModalUnitsPerPackage] = useState('');
  const [modalPieces, setModalPieces] = useState('');
  const [modalUnitPrice, setModalUnitPrice] = useState('');
  const [modalDiscount, setModalDiscount] = useState('0');
  const [modalDiscountPercent, setModalDiscountPercent] = useState('0');

  const canManageVouchers = hasPermission('vouchers.create');
  const canManageCatalog = hasPermission('catalog.manage');
  const canSeeStock = hasPermission('stock.manage');
  const [stockRevealId, setStockRevealId] = useState<string | null>(null);

  useEffect(() => {
    api.get<Category[]>('/categories').then(setCategories);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    if (sort) params.set('sort', sort);
    if (onlyInStock) params.set('availability', 'in_stock');
    if (onlyOnSale) params.set('onSale', 'true');
    if (onlyNew) params.set('isNew', 'true');
    params.set('pageSize', '48');

    setLoading(true);
    api
      .get<{ items: Product[]; total: number }>(`/products?${params.toString()}`, token)
      .then((res) => {
        setProducts(res.items);
        setTotal(res.total);
        setCatalogIndex((prev) => {
          const next = new Map(prev);
          res.items.forEach((p) => next.set(p.id, p));
          return next;
        });
      })
      .finally(() => setLoading(false));
  }, [search, categoryId, sort, onlyInStock, onlyOnSale, onlyNew, token]);

  useEffect(() => {
    if (token && canManageVouchers) {
      api.get<CustomerOption[]>('/customers', token).then(setCustomers);
    }
  }, [token, canManageVouchers]);

  const topCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  const availableTiers = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => p.prices.forEach((pr) => map.set(pr.tierKey, pr.label)));
    return Array.from(map.entries()).map(([tierKey, label]) => ({ tierKey, label }));
  }, [products]);

  useEffect(() => {
    if (availableTiers.length <= 1) {
      if (viewTier) setViewTier('');
      return;
    }
    if (!availableTiers.some((t) => t.tierKey === viewTier)) {
      const preferred = ['wholesale', 'retail'].find((key) => availableTiers.some((t) => t.tierKey === key));
      setViewTier(preferred ?? availableTiers[0].tierKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTiers]);

  function priceForView(p: Product): Price | undefined {
    if (viewTier) return p.prices.find((pr) => pr.tierKey === viewTier) ?? p.prices[0];
    return p.prices[0];
  }

  const activeCart = sessions.find((s) => s.id === activeId);
  const cartLines = activeCart?.items ?? [];
  const totalCartCount = sessions.reduce((s, sess) => s + sess.items.reduce((s2, i) => s2 + i.quantityPackages, 0), 0);
  const cartDetails = cartLines.map((line) => ({ line, product: catalogIndex.get(line.productId) }));
  const cartTotal = cartDetails.reduce((sum, { line, product }) => {
    if (!product) return sum;
    const price = priceForView(product)?.price;
    if (price == null) return sum;
    const standard = price * line.quantityPackages * product.unitsPerPackage;
    return sum + Math.max(0, standard - (line.discount || 0));
  }, 0);

  function openAddModal(p: Product) {
    const price = priceForView(p)?.price ?? 0;
    setAddingProduct(p);
    setModalQty('1');
    setModalUnitsPerPackage(String(p.unitsPerPackage));
    setModalPieces(String(p.unitsPerPackage));
    setModalUnitPrice(String(price));
    setModalDiscount('0');
    setModalDiscountPercent('0');
  }

  /** Sous-total plein (cartons catalogue × prix catalogue) — base de calcul du %. */
  function modalStandard(): number {
    if (!addingProduct) return 0;
    const catalogPrice = priceForView(addingProduct)?.price ?? 0;
    const qty = Math.max(0, Number(modalQty) || 0);
    return qty * addingProduct.unitsPerPackage * catalogPrice;
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

  function onModalQtyChange(v: string) {
    const clean = onlyDigits(v);
    setModalQty(clean);
    const qty = Math.max(0, Number(clean) || 0);
    const upp = Math.max(0, Number(modalUnitsPerPackage) || 0);
    setModalPieces(String(qty * upp));
  }

  function onModalUnitsPerPackageChange(v: string) {
    const clean = onlyDigits(v);
    setModalUnitsPerPackage(clean);
    const qty = Math.max(0, Number(modalQty) || 0);
    const upp = Math.max(0, Number(clean) || 0);
    setModalPieces(String(qty * upp));
  }

  function onModalPiecesChange(v: string) {
    const clean = onlyDigits(v);
    setModalPieces(clean);
    const upp = Math.max(0, Number(modalUnitsPerPackage) || 0);
    if (upp <= 0) return;
    const pieces = Math.max(0, Number(clean) || 0);
    setModalQty(String(Math.max(1, Math.ceil(pieces / upp))));
  }

  // Suggère automatiquement une remise = écart entre le prix catalogue plein
  // (cartons entiers) et ce que le vendeur indique réellement livrer/facturer —
  // utile quand un carton reçu est incomplet. Reste modifiable manuellement.
  useEffect(() => {
    if (!addingProduct) return;
    const catalogPrice = priceForView(addingProduct)?.price ?? 0;
    const qty = Math.max(0, Number(modalQty) || 0);
    const pieces = Math.max(0, Number(modalPieces) || 0);
    const unitPrice = Math.max(0, Number(modalUnitPrice) || 0);
    const standard = qty * addingProduct.unitsPerPackage * catalogPrice;
    const actual = pieces * unitPrice;
    const suggested = Math.max(0, Math.round((standard - actual) * 100) / 100);
    setModalDiscount(String(suggested));
    setModalDiscountPercent(standard > 0 ? String(Math.round((suggested / standard) * 10000) / 100) : '0');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalQty, modalPieces, modalUnitPrice, addingProduct]);

  function confirmAdd() {
    if (!addingProduct) return;
    const qty = Math.max(1, Number(modalQty) || 1);
    const discount = Math.max(0, Number(modalDiscount) || 0);
    const upp = Math.max(0, Number(modalUnitsPerPackage) || 0);
    const pieces = Math.max(0, Number(modalPieces) || 0);
    const isNominal = upp === addingProduct.unitsPerPackage && pieces === qty * upp;
    cart.add(addingProduct.id, qty, discount, isNominal ? undefined : { unitsPerPackage: upp, totalPieces: pieces });
    setAddingProduct(null);
  }

  // Le bon ne connaît que quantityPackages/discount — pas d'ajustement pièces/carton
  // par ligne. On rend l'écart traçable en le consignant dans les observations du bon.
  function buildAdjustmentNote(): string | null {
    const lines = cartLines
      .map((line) => {
        const product = catalogIndex.get(line.productId);
        if (!product) return null;
        const effectiveUpp = line.unitsPerPackage ?? product.unitsPerPackage;
        const nominalPieces = line.quantityPackages * effectiveUpp;
        const isAdjusted =
          (line.unitsPerPackage != null && line.unitsPerPackage !== product.unitsPerPackage) ||
          (line.totalPieces != null && line.totalPieces !== nominalPieces);
        if (!isAdjusted) return null;
        const actualPieces = line.totalPieces ?? nominalPieces;
        return `${localizedName(product, locale)} : ${actualPieces} ${t('pieces')} (${effectiveUpp}/${t('pieces')} × ${line.quantityPackages}) — remise ${(line.discount || 0).toLocaleString()} DA`;
      })
      .filter((s): s is string => Boolean(s));
    return lines.length > 0 ? `⚠ ${t('adjustedWarning')} : ${lines.join(' | ')}` : null;
  }

  async function checkout() {
    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }
    if (canManageVouchers && !selectedCustomerId) {
      setPickingCustomer(true);
      return;
    }

    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const payloadItems = cartLines.map((l) => ({ productId: l.productId, quantityPackages: l.quantityPackages }));
      const totalDiscount = cartLines.reduce((s, l) => s + (l.discount || 0), 0);
      const adjustmentNote = buildAdjustmentNote();

      if (canManageVouchers) {
        const voucher = await api.post<{ id: string }>('/vouchers/draft', { customerId: selectedCustomerId }, token);
        await api.put(`/vouchers/${voucher.id}`, { items: payloadItems, discount: totalDiscount, notes: adjustmentNote ?? undefined }, token);
        cart.closeSession(activeId);
        router.push(`/${locale}/vouchers/${voucher.id}`);
      } else {
        const voucher = await api.post<DraftVoucher>('/vouchers/mine/draft', undefined, token);
        const merged = new Map(voucher.items.map((i) => [i.product.id, i.quantityPackages]));
        for (const line of cartLines) {
          merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantityPackages);
        }
        const mergedItems = Array.from(merged.entries()).map(([productId, quantityPackages]) => ({ productId, quantityPackages }));
        const combinedNotes = [voucher.notes, adjustmentNote].filter(Boolean).join(' | ') || undefined;
        await api.put(`/vouchers/mine/${voucher.id}`, { items: mergedItems, discount: totalDiscount, notes: combinedNotes }, token);
        cart.closeSession(activeId);
        router.push(`/${locale}/vouchers/${voucher.id}`);
      }
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : tCommon('error'));
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-panel px-6 py-4 shadow-sm">
        <Link href={`/${locale}/catalog`} className="font-mono text-sm font-semibold uppercase tracking-wider text-accent">
          JIMI PLAST
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <Link href={`/${locale}/dashboard`} className="text-sm text-ink hover:underline">
              {user.fullName}
            </Link>
          ) : (
            <Link href={`/${locale}/login`} className="text-sm text-accent hover:underline">
              {tCommon('loginToSeePrices')}
            </Link>
          )}
          <LocaleSwitcher current={locale} />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
          {canManageCatalog && (
            <Link
              href={`/${locale}/products`}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              + {t('newProduct')}
            </Link>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="search"
            placeholder={tCommon('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded border border-line bg-panel px-3 py-2 text-sm"
          >
            <option value="">{t('allCategories')}</option>
            {topCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {localizedName(c, locale)}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded border border-line bg-panel px-3 py-2 text-sm"
          >
            <option value="priority">{t('sortPriority')}</option>
            <option value="newest">{t('sortNewest')}</option>
            <option value="name_asc">{t('sortNameAsc')}</option>
            <option value="name_desc">{t('sortNameDesc')}</option>
          </select>

          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} />
            {t('onlyInStock')}
          </label>
          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input type="checkbox" checked={onlyOnSale} onChange={(e) => setOnlyOnSale(e.target.checked)} />
            {t('onlyOnSale')}
          </label>
          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
            {t('onlyNew')}
          </label>

          {canManageVouchers && availableTiers.length > 1 && (
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <span className="text-xs text-muted">{t('viewPricesAs')}</span>
              <select
                value={viewTier}
                onChange={(e) => setViewTier(e.target.value)}
                className="rounded border border-accent bg-panel px-2 py-1.5 text-sm text-accent"
              >
                {availableTiers.map((tier) => (
                  <option key={tier.tierKey} value={tier.tierKey}>
                    {tier.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {!loading && products.length === 0 && (
          <p className="mt-10 text-center text-muted">{t('noResults')}</p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const mainPrice = priceForView(p);
            return (
              <div key={p.id} className="flex flex-col rounded-lg border border-line bg-panel p-3 shadow-sm">
                <div
                  className={`group relative mb-2 flex aspect-square items-center justify-center overflow-hidden rounded bg-paper text-muted ${
                    p.images.length > 0 ? 'cursor-zoom-in' : ''
                  }`}
                  onClick={() => p.images.length > 0 && setLightboxProduct(p)}
                >
                  {p.images[0] ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.images[0].url}
                        alt={localizedName(p, locale)}
                        className="h-full w-full rounded object-cover transition-transform duration-200 group-hover:scale-110"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                        <span className="scale-75 text-xl text-white opacity-0 transition group-hover:scale-100 group-hover:opacity-100">
                          🔍
                        </span>
                      </div>
                      {p.images.length > 1 && (
                        <span className="absolute bottom-1 end-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          +{p.images.length - 1}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-3xl">📦</span>
                  )}
                  <div className="absolute start-1 top-1 flex flex-col gap-1">
                    {p.isNew && (
                      <span className="rounded bg-teal px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {t('new')}
                      </span>
                    )}
                    {p.hasPromotion && (
                      <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {t('promo')}
                      </span>
                    )}
                  </div>
                </div>
                <p className="line-clamp-2 text-sm font-medium text-ink">{localizedName(p, locale)}</p>
                <p className="text-xs text-muted">
                  {p.category.parent ? `${localizedName(p.category.parent, locale)} › ` : ''}
                  {localizedName(p.category, locale)}
                </p>
                <p className="text-xs font-medium text-accent">
                  {t('piecesPerPackage', { count: p.unitsPerPackage, unit: p.packagingUnit.label })}
                </p>
                {p.costPrice != null && (
                  <p className="text-[11px] text-orange-600">
                    {t('costPrice')}: {p.costPrice.toLocaleString()} DA
                  </p>
                )}
                {canManageVouchers &&
                  (() => {
                    const factoryPrice = p.prices.find((pr) => pr.tierKey === 'factory');
                    return (
                      factoryPrice && (
                        <p className="text-[11px] text-muted">
                          {factoryPrice.label}: {factoryPrice.price.toLocaleString()} DA
                        </p>
                      )
                    );
                  })()}
                <div className="mt-2 flex items-center justify-between">
                  {mainPrice ? (
                    <div className="font-mono text-sm font-semibold text-ink">
                      {canManageVouchers && availableTiers.length > 1 && (
                        <span className="me-1 block text-[10px] font-normal text-muted">{mainPrice.label}</span>
                      )}
                      {mainPrice.hasPromotion && (
                        <span className="me-1 text-xs text-muted line-through">{mainPrice.originalPrice} DA</span>
                      )}
                      {mainPrice.price} DA
                    </div>
                  ) : (
                    <span className="text-xs text-muted">{tCommon('loginToSeePrices')}</span>
                  )}
                  <div className="relative">
                    {canSeeStock ? (
                      <button
                        type="button"
                        onClick={() => setStockRevealId((id) => (id === p.id ? null : p.id))}
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          p.availability === 'IN_STOCK' ? 'bg-teal/15 text-teal' : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {p.availability === 'IN_STOCK' ? t('inStock') : t('outOfStock')}
                      </button>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          p.availability === 'IN_STOCK' ? 'bg-teal/15 text-teal' : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {p.availability === 'IN_STOCK' ? t('inStock') : t('outOfStock')}
                      </span>
                    )}
                    {canSeeStock && stockRevealId === p.id && p.currentStock != null && (
                      <div className="absolute end-0 top-full z-10 mt-1 whitespace-nowrap rounded border border-line bg-panel px-2 py-1 text-[11px] text-ink shadow-lg">
                        {t('stockCartons', { count: Math.floor(p.currentStock / p.unitsPerPackage) })}
                        {p.currentStock % p.unitsPerPackage > 0 && (
                          <span className="text-muted"> + {p.currentStock % p.unitsPerPackage} {t('pieces')}</span>
                        )}
                        <span className="ms-1 text-muted">({p.currentStock} {t('pieces')})</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {p.availability === 'IN_STOCK' && (
                    <button
                      onClick={() => openAddModal(p)}
                      className="flex-1 rounded bg-accent px-2 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      {t('addToCart')}
                    </button>
                  )}
                  {canManageCatalog && (
                    <Link
                      href={`/${locale}/products?edit=${p.id}`}
                      className="rounded border border-line px-2 py-1.5 text-xs text-ink hover:bg-line/30"
                    >
                      {tCommon('edit')}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!loading && (
          <p className="mt-6 text-center text-xs text-muted">{total} produits</p>
        )}
      </div>

      <button
        onClick={() => setShowCart(true)}
        aria-label={t('cart')}
        className="fixed bottom-5 end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-white shadow-lg transition hover:scale-105 hover:opacity-90"
      >
        🛒
        {totalCartCount > 0 && (
          <span className="absolute -end-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-paper bg-red-600 px-1 text-xs font-bold text-white">
            {totalCartCount}
          </span>
        )}
      </button>

      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setShowCart(false)}>
          <div className="flex h-full w-full max-w-sm flex-col bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">{t('cart')}</h2>
              <button onClick={() => setShowCart(false)} className="text-sm text-muted hover:text-ink">
                ✕
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {sessions.map((s, i) => (
                <div
                  key={s.id}
                  onClick={() => cart.setActiveId(s.id)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                    s.id === activeId ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-line text-muted hover:bg-line/30'
                  }`}
                >
                  <span>{s.label || `${t('cart')} ${i + 1}`}</span>
                  {s.items.length > 0 && (
                    <span className="rounded-full bg-line/50 px-1.5 text-[10px]">
                      {s.items.reduce((sum, it) => sum + it.quantityPackages, 0)}
                    </span>
                  )}
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cart.closeSession(s.id);
                      }}
                      className="text-muted hover:text-red-600"
                      aria-label={t('closeCart')}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => cart.createSession()}
                className="rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
              >
                + {t('newCart')}
              </button>
            </div>

            {activeCart && (
              <input
                value={activeCart.label}
                onChange={(e) => cart.renameSession(activeCart.id, e.target.value)}
                placeholder={t('cartLabelPlaceholder')}
                className="mt-2 rounded border border-line bg-paper px-2 py-1 text-xs"
              />
            )}

            {cartDetails.length === 0 ? (
              <p className="mt-6 text-sm text-muted">{t('cartEmpty')}</p>
            ) : (
              <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto">
                {cartDetails.map(({ line, product }) => {
                  const unitPrice = product ? priceForView(product)?.price : undefined;
                  const effectiveUpp = line.unitsPerPackage ?? product?.unitsPerPackage;
                  const nominalPieces = effectiveUpp != null ? line.quantityPackages * effectiveUpp : undefined;
                  const totalPieces = line.totalPieces ?? nominalPieces;
                  const lineStandard =
                    unitPrice != null && product ? unitPrice * line.quantityPackages * product.unitsPerPackage : undefined;
                  const lineTotal = lineStandard != null ? Math.max(0, lineStandard - (line.discount || 0)) : undefined;
                  const isAdjusted =
                    (product && line.unitsPerPackage != null && line.unitsPerPackage !== product.unitsPerPackage) ||
                    (nominalPieces != null && line.totalPieces != null && line.totalPieces !== nominalPieces);
                  return (
                    <div
                      key={line.productId}
                      className={`rounded border p-2 ${isAdjusted ? 'border-amber-500 bg-amber-500/10' : 'border-line'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-ink">{product ? localizedName(product, locale) : line.productId}</p>
                        {isAdjusted && (
                          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            ⚠ {t('adjusted')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={line.quantityPackages}
                          onChange={(e) => cart.setQuantity(activeId, line.productId, Math.max(1, Number(onlyDigits(e.target.value)) || 1))}
                          className="w-16 rounded border border-line bg-paper px-2 py-1 text-xs"
                        />
                        <span className="text-xs text-muted">
                          {product?.packagingUnit.label ?? ''}
                          {totalPieces != null && ` (${totalPieces} ${t('pieces')})`}
                        </span>
                        <button onClick={() => cart.remove(activeId, line.productId)} className="ms-auto text-xs text-red-600 hover:underline">
                          {tCommon('delete')}
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[11px] text-muted">{t('discount')}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={lineStandard ? Math.round(((line.discount || 0) / lineStandard) * 10000) / 100 : 0}
                          onChange={(e) => {
                            const pct = Math.max(0, Number(onlyDecimal(e.target.value)) || 0);
                            cart.setDiscount(activeId, line.productId, lineStandard ? Math.round(lineStandard * (pct / 100) * 100) / 100 : 0);
                          }}
                          className="w-12 rounded border border-line bg-paper px-1.5 py-0.5 text-xs"
                        />
                        <span className="text-[10px] text-muted">%</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.discount || 0}
                          onChange={(e) => cart.setDiscount(activeId, line.productId, Math.max(0, Number(onlyDecimal(e.target.value)) || 0))}
                          className="w-16 rounded border border-line bg-paper px-1.5 py-0.5 text-xs"
                        />
                        <span className="text-[10px] text-muted">DA</span>
                        {lineTotal != null && <span className="ms-auto text-xs font-medium tabular text-ink">{lineTotal.toLocaleString()} DA</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {cartDetails.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                {cartTotal > 0 && (
                  <div className="mb-2 flex justify-between text-sm font-semibold text-ink">
                    <span>{t('cartTotal')}</span>
                    <span className="tabular">{cartTotal.toLocaleString()} DA</span>
                  </div>
                )}
                {checkoutError && <p className="mb-2 text-xs text-red-600">{checkoutError}</p>}
                <button
                  onClick={checkout}
                  disabled={checkingOut}
                  className="w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {checkingOut ? tCommon('loading') : t('checkout')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {pickingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPickingCustomer(false)}>
          <div className="w-full max-w-sm rounded-lg bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-semibold text-ink">{t('chooseCustomer')}</h2>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
            >
              <option value="">{t('chooseCustomer')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user.fullName}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setPickingCustomer(false);
                if (selectedCustomerId) checkout();
              }}
              disabled={!selectedCustomerId}
              className="mt-3 w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t('checkout')}
            </button>
          </div>
        </div>
      )}

      {addingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddingProduct(null)}>
          <div className="w-full max-w-sm rounded-lg bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-sm font-semibold text-ink">{localizedName(addingProduct, locale)}</h2>
            <p className="mb-3 text-xs font-medium text-accent">
              {t('piecesPerPackage', { count: addingProduct.unitsPerPackage, unit: addingProduct.packagingUnit.label })}
            </p>

            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('quantityCartons')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={modalQty}
                  onChange={(e) => onModalQtyChange(e.target.value)}
                  className="rounded border border-line bg-paper px-2 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('unitsPerPackage')}</span>
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
                <span className="text-muted">{t('totalPieces')}</span>
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
              <p className="mt-1 text-[11px] font-medium text-amber-600">{t('adjustedWarning')}</p>
            )}
            <p className="mt-1 text-[11px] text-muted">{t('piecesHint')}</p>

            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="text-muted">{t('unitPrice')}</span>
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
              const qty = Math.max(0, Number(modalQty) || 0);
              const discount = Math.max(0, Number(modalDiscount) || 0);
              const standard = catalogPrice != null ? qty * addingProduct.unitsPerPackage * catalogPrice : undefined;
              const actual = Math.max(0, Number(modalPieces) || 0) * Math.max(0, Number(modalUnitPrice) || 0);
              const total = standard != null ? Math.max(0, standard - discount) : actual;
              return (
                <div className="mt-3 flex flex-col gap-1.5 text-sm">
                  {standard != null && <ModalRow label={t('subtotal')} value={`${standard.toLocaleString()} DA`} />}
                  <div className="flex items-center justify-between gap-2 text-muted">
                    <span>{t('discount')}</span>
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
                  <ModalRow label={t('total')} value={`${total.toLocaleString()} DA`} bold />
                </div>
              );
            })()}

            <button onClick={confirmAdd} className="mt-4 w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white">
              {t('confirmAdd')}
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
