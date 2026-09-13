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
  prices: Price[];
  hasPromotion: boolean;
}

interface CustomerOption {
  id: string;
  user: { fullName: string };
}

interface DraftVoucher {
  id: string;
  items: { product: { id: string }; quantityPackages: number }[];
}

const localizedName = (item: { nameFr: string; nameAr?: string | null; nameEn?: string | null }, locale: string) => {
  if (locale === 'ar' && item.nameAr) return item.nameAr;
  if (locale === 'en' && item.nameEn) return item.nameEn;
  return item.nameFr;
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
  const [modalDiscount, setModalDiscount] = useState('0');

  const canManageVouchers = hasPermission('vouchers.create');
  const canManageCatalog = hasPermission('catalog.manage');

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
    const price = (product ? priceForView(product)?.price : undefined) ?? 0;
    return sum + Math.max(0, price * line.quantityPackages - (line.discount || 0));
  }, 0);

  function openAddModal(p: Product) {
    setAddingProduct(p);
    setModalQty('1');
    setModalDiscount('0');
  }

  function confirmAdd() {
    if (!addingProduct) return;
    const qty = Math.max(1, Number(modalQty) || 1);
    const discount = Math.max(0, Number(modalDiscount) || 0);
    cart.add(addingProduct.id, qty, discount);
    setAddingProduct(null);
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

      if (canManageVouchers) {
        const voucher = await api.post<{ id: string }>('/vouchers/draft', { customerId: selectedCustomerId }, token);
        await api.put(`/vouchers/${voucher.id}`, { items: payloadItems, discount: totalDiscount }, token);
        cart.closeSession(activeId);
        router.push(`/${locale}/vouchers/${voucher.id}`);
      } else {
        const voucher = await api.post<DraftVoucher>('/vouchers/mine/draft', undefined, token);
        const merged = new Map(voucher.items.map((i) => [i.product.id, i.quantityPackages]));
        for (const line of cartLines) {
          merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantityPackages);
        }
        const mergedItems = Array.from(merged.entries()).map(([productId, quantityPackages]) => ({ productId, quantityPackages }));
        await api.put(`/vouchers/mine/${voucher.id}`, { items: mergedItems, discount: totalDiscount }, token);
        cart.closeSession(activeId);
        router.push(`/${locale}/vouchers/${voucher.id}`);
      }
    } catch {
      setCheckoutError(tCommon('error'));
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
          <button
            onClick={() => setShowCart(true)}
            className="relative rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-line/30"
          >
            🛒 {t('cart')}
            {totalCartCount > 0 && (
              <span className="absolute -end-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                {totalCartCount}
              </span>
            )}
          </button>
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

          {availableTiers.length > 1 && (
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
                <p className="text-xs text-muted">
                  {t('piecesPerPackage', { count: p.unitsPerPackage, unit: p.packagingUnit.label })}
                </p>
                {p.costPrice != null && (
                  <p className="text-[11px] text-orange-600">
                    {t('costPrice')}: {p.costPrice.toLocaleString()} DA
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  {mainPrice ? (
                    <div className="font-mono text-sm font-semibold text-ink">
                      {availableTiers.length > 1 && (
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      p.availability === 'IN_STOCK' ? 'bg-teal/15 text-teal' : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {p.availability === 'IN_STOCK' ? t('inStock') : t('outOfStock')}
                  </span>
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
                  const lineTotal = unitPrice != null ? Math.max(0, unitPrice * line.quantityPackages - (line.discount || 0)) : undefined;
                  return (
                    <div key={line.productId} className="rounded border border-line p-2">
                      <p className="text-sm font-medium text-ink">{product ? localizedName(product, locale) : line.productId}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={line.quantityPackages}
                          onChange={(e) => cart.setQuantity(activeId, line.productId, Math.max(1, Number(e.target.value)))}
                          className="w-16 rounded border border-line bg-paper px-2 py-1 text-xs"
                        />
                        <span className="text-xs text-muted">{product?.packagingUnit.label ?? ''}</span>
                        <button onClick={() => cart.remove(activeId, line.productId)} className="ms-auto text-xs text-red-600 hover:underline">
                          {tCommon('delete')}
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] text-muted">
                          {t('discount')}
                          <input
                            type="number"
                            min={0}
                            value={line.discount || 0}
                            onChange={(e) => cart.setDiscount(activeId, line.productId, Math.max(0, Number(e.target.value)))}
                            className="w-16 rounded border border-line bg-paper px-1.5 py-0.5 text-xs"
                          />
                        </label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAddingProduct(null)}>
          <div className="w-full max-w-sm rounded-lg bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-sm font-semibold text-ink">{localizedName(addingProduct, locale)}</h2>
            <p className="mb-3 text-xs text-muted">
              {t('piecesPerPackage', { count: addingProduct.unitsPerPackage, unit: addingProduct.packagingUnit.label })}
            </p>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{t('quantityCartons')}</span>
              <input
                type="number"
                min={1}
                value={modalQty}
                onChange={(e) => setModalQty(e.target.value)}
                className="rounded border border-line bg-paper px-3 py-2"
              />
            </label>

            {(() => {
              const price = priceForView(addingProduct);
              const qty = Math.max(1, Number(modalQty) || 1);
              const totalPieces = qty * addingProduct.unitsPerPackage;
              const subtotal = (price?.price ?? 0) * qty;
              const discount = Math.max(0, Number(modalDiscount) || 0);
              const finalTotal = Math.max(0, subtotal - discount);
              return (
                <div className="mt-3 flex flex-col gap-1.5 text-sm">
                  <ModalRow label={t('totalPieces')} value={String(totalPieces)} />
                  {price && <ModalRow label={t('unitPrice')} value={`${price.price} DA`} />}
                  {price && <ModalRow label={t('subtotal')} value={`${subtotal.toLocaleString()} DA`} />}
                  <label className="flex items-center justify-between gap-2 text-muted">
                    <span>{t('discount')}</span>
                    <input
                      type="number"
                      min={0}
                      value={modalDiscount}
                      onChange={(e) => setModalDiscount(e.target.value)}
                      className="w-24 rounded border border-line bg-paper px-2 py-1 text-end text-ink"
                    />
                  </label>
                  {price && <ModalRow label={t('total')} value={`${finalTotal.toLocaleString()} DA`} bold />}
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
