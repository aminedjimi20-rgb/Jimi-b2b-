'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';
import { ImageLightbox } from '@/components/image-lightbox';
import { SortSelect, type SortMode } from '@/components/sort-select';

interface Category {
  id: string;
  nameFr: string;
}
interface Manufacturer {
  id: string;
  name: string;
}
interface PackagingUnit {
  id: string;
  key: string;
  label: string;
}
interface DepotOption {
  id: string;
  name: string;
}
interface PriceTierType {
  id: string;
  key: string;
  label: string;
}
interface Promotion {
  id: string;
  priceTierType: PriceTierType;
  discountType: 'PERCENT' | 'AMOUNT';
  discountValue: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}
interface LastChange {
  at: string;
  kind: 'field' | 'price';
  field: string | null;
  label: string | null;
  oldValue: unknown;
  newValue: unknown;
  actorName: string | null;
}
interface FullProduct {
  id: string;
  sku: string;
  categoryId: string;
  manufacturerId: string | null;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  brand: string | null;
  packagingUnitId: string;
  unitsPerPackage: number;
  depot: string | null;
  costPrice: string | null;
  currentStock: number;
  stockMin: number;
  isNew: boolean;
  isFeatured: boolean;
  isActive: boolean;
  isSeasonal: boolean;
  seasonStart: string | null;
  seasonEnd: string | null;
  isClearance: boolean;
  createdAt: string;
  category: { nameFr: string };
  manufacturer: { name: string } | null;
  images: { id: string; url: string; isPrimary: boolean }[];
  prices: { priceTierType: PriceTierType; price: string }[];
  promotions: Promotion[];
}

const EMPTY_FORM = {
  sku: '',
  categoryId: '',
  manufacturerId: '',
  nameFr: '',
  nameAr: '',
  nameEn: '',
  brand: '',
  packagingUnitId: '',
  unitsPerPackage: '1',
  depot: '',
  costPrice: '',
  currentStock: '0',
  stockMin: '0',
  isNew: false,
  isFeatured: false,
  isActive: true,
  isSeasonal: false,
  seasonStart: '',
  seasonEnd: '',
  isClearance: false,
  priceFactory: '',
  priceWholesale: '',
  priceRetail: '',
};

const PRODUCTS_PAGE_SIZE = 40;

export default function ProductsAdminPage() {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  const [products, setProducts] = useState<FullProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [packagingUnits, setPackagingUnits] = useState<PackagingUnit[]>([]);
  const [priceTierTypes, setPriceTierTypes] = useState<PriceTierType[]>([]);
  const [depots, setDepots] = useState<DepotOption[]>([]);
  const [showDepotManager, setShowDepotManager] = useState(false);
  const [newDepotName, setNewDepotName] = useState('');
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PAGE_SIZE);
  const loadMoreRef = useRef<HTMLTableRowElement>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newProductImages, setNewProductImages] = useState<string[]>([]);
  const [viewingImages, setViewingImages] = useState<{ images: { url: string }[]; startIndex: number } | null>(null);
  const [stockUnit, setStockUnit] = useState<'pieces' | 'cartons'>('pieces');
  const [promoForm, setPromoForm] = useState({ priceTierTypeId: '', discountType: 'PERCENT' as 'PERCENT' | 'AMOUNT', discountValue: '', startDate: '', endDate: '' });
  const [error, setError] = useState<string | null>(null);
  const [appliedEditParam, setAppliedEditParam] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [lastChanges, setLastChanges] = useState<Record<string, LastChange | null>>({});

  useEffect(() => {
    setVisibleCount(PRODUCTS_PAGE_SIZE);
  }, [search, categoryFilter, manufacturerFilter, sortMode]);

  function reloadDepots() {
    api.get<DepotOption[]>('/depots').then(setDepots);
  }

  function reloadProducts() {
    // Une seule requête pour toute la liste (plus de N+1 par produit) —
    // reste fluide même avec des centaines de fiches.
    api.get<FullProduct[]>('/products/admin/list', token).then(setProducts);
  }

  useEffect(() => {
    if (!token) return;
    reloadProducts();
    api.get<Category[]>('/categories').then(setCategories);
    api.get<Manufacturer[]>('/manufacturers', token).then(setManufacturers);
    api.get<PackagingUnit[]>('/catalog-settings/packaging-units').then(setPackagingUnits);
    api.get<PriceTierType[]>('/catalog-settings/price-tier-types').then(setPriceTierTypes);
    reloadDepots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function addDepot() {
    const name = newDepotName.trim();
    if (!name) return;
    try {
      await api.post('/depots', { name }, token);
      setNewDepotName('');
      reloadDepots();
    } catch {
      setError(tCommon('error'));
    }
  }

  async function removeDepot(id: string) {
    await api.delete(`/depots/${id}`, token);
    reloadDepots();
  }

  // Scroll fluide sur une longue liste (200+ produits) : on n'affiche qu'un
  // lot à la fois, et on en charge davantage quand la ligne sentinelle
  // devient visible en bas de tableau — pas de pagination cliquable.
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((v) => v + PRODUCTS_PAGE_SIZE);
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount]);

  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (!editParam || editParam === appliedEditParam) return;
    const target = products.find((p) => p.id === editParam);
    if (!target) return;
    startEdit(target);
    setAppliedEditParam(editParam);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, products, appliedEditParam]);

  const tierId = (key: string) => priceTierTypes.find((p) => p.key === key)?.id;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceInputs: [string, string][] = [
      ['factory', form.priceFactory],
      ['wholesale', form.priceWholesale],
      ['retail', form.priceRetail],
    ];
    const prices = priceInputs
      .filter(([, value]) => value !== '')
      .map(([key, value]) => ({ priceTierTypeId: tierId(key), price: Number(value) }))
      .filter((p): p is { priceTierTypeId: string; price: number } => Boolean(p.priceTierTypeId));

    const payload = {
      sku: form.sku,
      categoryId: form.categoryId,
      manufacturerId: form.manufacturerId || undefined,
      nameFr: form.nameFr,
      nameAr: form.nameAr || undefined,
      nameEn: form.nameEn || undefined,
      brand: form.brand || undefined,
      packagingUnitId: form.packagingUnitId,
      unitsPerPackage: Number(form.unitsPerPackage) || 1,
      depot: form.depot || undefined,
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      currentStock: Number(form.currentStock) || 0,
      stockMin: Number(form.stockMin) || 0,
      isNew: form.isNew,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
      isSeasonal: form.isSeasonal,
      seasonStart: form.isSeasonal && form.seasonStart ? form.seasonStart : undefined,
      seasonEnd: form.isSeasonal && form.seasonEnd ? form.seasonEnd : undefined,
      isClearance: form.isClearance,
      ...(editingId ? {} : { prices }),
    };

    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, payload, token);
        // les prix se mettent à jour un par un pour garder l'historique
        for (const p of prices) {
          if (p.priceTierTypeId) {
            await api.put(`/products/${editingId}/price`, { priceTierTypeId: p.priceTierTypeId, price: p.price }, token);
          }
        }
      } else {
        const created = await api.post<{ id: string }>('/products', payload, token);
        for (const url of newProductImages) {
          await api.post(`/products/${created.id}/images`, { url }, token);
        }
        setNewProductImages([]);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      reloadProducts();
    } catch {
      setError(tCommon('error'));
    }
  }

  function startEdit(p: FullProduct) {
    setEditingId(p.id);
    setNewProductImages([]);
    setPromoForm({ priceTierTypeId: '', discountType: 'PERCENT', discountValue: '', startDate: '', endDate: '' });
    const priceOf = (key: string) => p.prices.find((pr) => pr.priceTierType.key === key)?.price ?? '';
    setForm({
      sku: p.sku,
      categoryId: p.categoryId,
      manufacturerId: p.manufacturerId ?? '',
      nameFr: p.nameFr,
      nameAr: p.nameAr ?? '',
      nameEn: p.nameEn ?? '',
      brand: p.brand ?? '',
      packagingUnitId: p.packagingUnitId,
      unitsPerPackage: String(p.unitsPerPackage),
      depot: p.depot ?? '',
      costPrice: p.costPrice ?? '',
      currentStock: String(p.currentStock),
      stockMin: String(p.stockMin),
      isNew: p.isNew,
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      isSeasonal: p.isSeasonal,
      seasonStart: p.seasonStart ? p.seasonStart.slice(0, 10) : '',
      seasonEnd: p.seasonEnd ? p.seasonEnd.slice(0, 10) : '',
      isClearance: p.isClearance,
      priceFactory: String(priceOf('factory')),
      priceWholesale: String(priceOf('wholesale')),
      priceRetail: String(priceOf('retail')),
    });
  }

  async function remove(p: FullProduct) {
    if (!window.confirm(t('deleteConfirm'))) return;
    await api.delete(`/products/${p.id}`, token);
    if (editingId === p.id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    reloadProducts();
  }

  async function addImageFromUrl(url: string) {
    if (!editingId || !url) return;
    await api.post(`/products/${editingId}/images`, { url }, token);
    reloadProducts();
  }

  async function addImage() {
    await addImageFromUrl(newImageUrl);
    setNewImageUrl('');
  }

  async function removeImage(imageId: string) {
    await api.delete(`/products/images/${imageId}`, token);
    reloadProducts();
  }

  function removeNewProductImage(index: number) {
    setNewProductImages((imgs) => imgs.filter((_, i) => i !== index));
  }

  async function addPromotion() {
    if (!editingId || !promoForm.priceTierTypeId || !promoForm.startDate || !promoForm.endDate) return;
    try {
      await api.post(
        `/products/${editingId}/promotions`,
        {
          priceTierTypeId: promoForm.priceTierTypeId,
          discountType: promoForm.discountType,
          discountValue: Number(promoForm.discountValue) || 0,
          startDate: promoForm.startDate,
          endDate: promoForm.endDate,
        },
        token,
      );
      setPromoForm({ priceTierTypeId: '', discountType: 'PERCENT', discountValue: '', startDate: '', endDate: '' });
      reloadProducts();
    } catch {
      setError(tCommon('error'));
    }
  }

  async function togglePromotionActive(promo: Promotion) {
    await api.put(
      `/products/promotions/${promo.id}`,
      {
        priceTierTypeId: promo.priceTierType.id,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue),
        startDate: promo.startDate,
        endDate: promo.endDate,
        isActive: !promo.isActive,
      },
      token,
    );
    reloadProducts();
  }

  async function removePromotion(promotionId: string) {
    if (!window.confirm(t('promotions.deleteConfirm'))) return;
    await api.delete(`/products/promotions/${promotionId}`, token);
    reloadProducts();
  }

  const editingProduct = products.find((p) => p.id === editingId);
  const currentImages = editingId ? (editingProduct?.images ?? []) : newProductImages.map((url, i) => ({ id: `new-${i}`, url }));
  const upp = Number(form.unitsPerPackage) || 1;
  const stockDisplayValue = stockUnit === 'pieces' ? form.currentStock : upp > 0 ? String(Math.round(((Number(form.currentStock) || 0) / upp) * 100) / 100) : form.currentStock;

  function onStockDisplayChange(v: string) {
    const num = Number(v) || 0;
    const pieces = stockUnit === 'cartons' ? Math.round(num * upp) : Math.round(num);
    setForm((f) => ({ ...f, currentStock: String(pieces) }));
  }

  const filteredProducts = products
    .filter((p) => {
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      if (manufacturerFilter && p.manufacturerId !== manufacturerFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        const haystack = `${p.sku} ${p.nameFr} ${p.nameAr ?? ''} ${p.nameEn ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortMode) {
        case 'name_asc':
          return a.nameFr.localeCompare(b.nameFr);
        case 'name_desc':
          return b.nameFr.localeCompare(a.nameFr);
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  // La colonne "Dernière modification" ne se charge que pour les lignes
  // réellement visibles — évite un aller-retour par produit dès l'ouverture
  // de la page quand il y en a des centaines.
  useEffect(() => {
    if (!token) return;
    const pending = filteredProducts.slice(0, visibleCount).filter((p) => !(p.id in lastChanges));
    if (pending.length === 0) return;
    Promise.all(
      pending.map((p) =>
        api
          .get<LastChange | null>(`/products/${p.id}/last-change`, token)
          .then((change) => [p.id, change] as const)
          .catch(() => [p.id, null] as const),
      ),
    ).then((entries) => setLastChanges((prev) => ({ ...prev, ...Object.fromEntries(entries) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filteredProducts, visibleCount]);

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tCommon('search')}
            className="w-56 rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border border-line bg-panel px-3 py-2 text-sm"
          >
            <option value="">{t('form.category')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameFr}
              </option>
            ))}
          </select>
          <select
            value={manufacturerFilter}
            onChange={(e) => setManufacturerFilter(e.target.value)}
            className="rounded border border-line bg-panel px-3 py-2 text-sm"
          >
            <option value="">{t('form.manufacturer')}</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <SortSelect value={sortMode} onChange={setSortMode} options={['newest', 'oldest', 'name_asc', 'name_desc']} />
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-line/30 text-xs uppercase text-muted">
              <tr>
                <th className="px-2 py-2"></th>
                <th className="px-4 py-2 text-start">{t('columns.sku')}</th>
                <th className="px-4 py-2 text-start">{t('columns.name')}</th>
                <th className="px-4 py-2 text-start">{t('columns.category')}</th>
                <th className="px-4 py-2 text-start">{t('form.manufacturer')}</th>
                <th className="px-4 py-2 text-start">{t('columns.stock')}</th>
                <th className="px-4 py-2 text-start">{t('columns.status')}</th>
                <th className="px-4 py-2 text-start">{t('columns.lastChange')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.slice(0, visibleCount).map((p) => {
                const change = lastChanges[p.id];
                return (
                  <tr key={p.id} className={`border-t border-line ${editingId === p.id ? 'bg-accent/5' : ''}`}>
                    <td className="px-2 py-2">
                      <div className="h-9 w-9 overflow-hidden rounded border border-line bg-paper">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-2 font-medium text-ink">{p.nameFr}</td>
                    <td className="px-4 py-2 text-xs text-muted">{p.category.nameFr}</td>
                    <td className="px-4 py-2 text-xs text-muted">{p.manufacturer?.name ?? '—'}</td>
                    <td className="px-4 py-2 tabular">{p.currentStock}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          p.isActive ? 'bg-teal/15 text-teal' : 'bg-line/40 text-muted'
                        }`}
                      >
                        {p.isActive ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted">
                      {change ? (
                        <>
                          <p className="text-ink">{describeChange(change, t)}</p>
                          <p className="text-[10px]">
                            {new Date(change.at).toLocaleString()}
                            {change.actorName && ` — ${change.actorName}`}
                          </p>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="flex gap-2 px-4 py-2 text-end">
                      <button onClick={() => startEdit(p)} className="text-xs text-accent hover:underline">
                        {tCommon('edit')}
                      </button>
                      <button onClick={() => remove(p)} className="text-xs text-red-600 hover:underline">
                        {tCommon('delete')}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleCount < filteredProducts.length && (
                <tr ref={loadMoreRef}>
                  <td colSpan={9} className="px-4 py-3 text-center text-xs text-muted">
                    {tCommon('loading')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredProducts.length === 0 && <p className="p-4 text-center text-xs text-muted">{tCommon('empty')}</p>}
        </div>
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="w-full rounded-lg border border-line bg-panel p-4 xl:w-96">
        <h2 className="text-sm font-semibold text-ink">{editingId ? t('editProduct') : t('addProduct')}</h2>
        <div className="mt-3 flex flex-col gap-3">
          <Field label={t('form.sku')} value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('form.category')}</span>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="rounded border border-line bg-paper px-3 py-2"
            >
              <option value=""></option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameFr}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('form.manufacturer')}</span>
            <select
              value={form.manufacturerId}
              onChange={(e) => setForm({ ...form, manufacturerId: e.target.value })}
              className="rounded border border-line bg-paper px-3 py-2"
            >
              <option value="">{t('form.noManufacturer')}</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <Field label={t('form.nameFr')} value={form.nameFr} onChange={(v) => setForm({ ...form, nameFr: v })} />
          <Field label={t('form.nameAr')} value={form.nameAr} onChange={(v) => setForm({ ...form, nameAr: v })} />
          <Field label={t('form.nameEn')} value={form.nameEn} onChange={(v) => setForm({ ...form, nameEn: v })} />
          <Field label={t('form.brand')} value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('form.packagingUnit')}</span>
            <select
              value={form.packagingUnitId}
              onChange={(e) => setForm({ ...form, packagingUnitId: e.target.value })}
              className="rounded border border-line bg-paper px-3 py-2"
            >
              <option value=""></option>
              {packagingUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={t('form.unitsPerPackage')}
            type="number"
            value={form.unitsPerPackage}
            onChange={(v) => setForm({ ...form, unitsPerPackage: v })}
          />

          <label className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">{t('form.depot')}</span>
              <button
                type="button"
                onClick={() => setShowDepotManager((v) => !v)}
                className="text-xs text-accent hover:underline"
              >
                {t('form.manageDepots')}
              </button>
            </div>
            <input
              list="product-depot-options"
              value={form.depot}
              onChange={(e) => setForm({ ...form, depot: e.target.value })}
              className="rounded border border-line bg-paper px-3 py-2"
            />
            <datalist id="product-depot-options">
              {depots.map((d) => (
                <option key={d.id} value={d.name} />
              ))}
            </datalist>
          </label>

          {showDepotManager && (
            <div className="rounded border border-line bg-paper p-2">
              <div className="flex gap-2">
                <input
                  value={newDepotName}
                  onChange={(e) => setNewDepotName(e.target.value)}
                  placeholder={t('form.newDepotPlaceholder')}
                  className="flex-1 rounded border border-line bg-panel px-2 py-1 text-sm"
                />
                <button type="button" onClick={addDepot} className="rounded bg-accent px-2 py-1 text-xs font-medium text-white">
                  {tCommon('add')}
                </button>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {depots.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-xs text-ink">
                    <span>{d.name}</span>
                    <button type="button" onClick={() => removeDepot(d.id)} className="text-red-600 hover:underline">
                      {tCommon('delete')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Field
              label={t('form.priceFactory')}
              type="number"
              value={form.priceFactory}
              onChange={(v) => setForm({ ...form, priceFactory: v })}
            />
            <Field
              label={t('form.priceWholesale')}
              type="number"
              value={form.priceWholesale}
              onChange={(v) => setForm({ ...form, priceWholesale: v })}
            />
            <Field
              label={t('form.priceRetail')}
              type="number"
              value={form.priceRetail}
              onChange={(v) => setForm({ ...form, priceRetail: v })}
            />
          </div>

          <Field
            label={t('form.costPrice')}
            type="number"
            value={form.costPrice}
            onChange={(v) => setForm({ ...form, costPrice: v })}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">{t('form.currentStock')}</span>
                <div className="flex overflow-hidden rounded border border-line text-[10px]">
                  <button
                    type="button"
                    onClick={() => setStockUnit('pieces')}
                    className={`px-1.5 py-0.5 ${stockUnit === 'pieces' ? 'bg-accent text-white' : 'text-muted'}`}
                  >
                    {t('form.stockPieces')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockUnit('cartons')}
                    className={`px-1.5 py-0.5 ${stockUnit === 'cartons' ? 'bg-accent text-white' : 'text-muted'}`}
                  >
                    {t('form.stockCartons')}
                  </button>
                </div>
              </div>
              <input
                type="number"
                value={stockDisplayValue}
                onChange={(e) => onStockDisplayChange(e.target.value)}
                className="rounded border border-line bg-paper px-3 py-2"
              />
            </label>
            <Field
              label={t('form.stockMin')}
              type="number"
              value={form.stockMin}
              onChange={(v) => setForm({ ...form, stockMin: v })}
            />
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={form.isNew} onChange={(e) => setForm({ ...form, isNew: e.target.checked })} />
              {t('form.isNew')}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
              />
              {t('form.isFeatured')}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              {t('form.isActive')}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.isSeasonal}
                onChange={(e) => setForm({ ...form, isSeasonal: e.target.checked })}
              />
              {t('form.isSeasonal')}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.isClearance}
                onChange={(e) => setForm({ ...form, isClearance: e.target.checked })}
              />
              {t('form.isClearance')}
            </label>
          </div>

          {form.isSeasonal && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('form.seasonStart')}</span>
                <input
                  type="date"
                  value={form.seasonStart}
                  onChange={(e) => setForm({ ...form, seasonStart: e.target.value })}
                  className="rounded border border-line bg-paper px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('form.seasonEnd')}</span>
                <input
                  type="date"
                  value={form.seasonEnd}
                  onChange={(e) => setForm({ ...form, seasonEnd: e.target.value })}
                  className="rounded border border-line bg-paper px-3 py-2"
                />
              </label>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted">{t('form.images')}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {currentImages.map((img, index) => (
                <div key={img.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setViewingImages({ images: currentImages, startIndex: index })}
                    className="block h-14 w-14 overflow-hidden rounded border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => (editingId ? removeImage(img.id) : removeNewProductImage(index))}
                    className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {editingId && (
                <>
                  <input
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="flex-1 rounded border border-line bg-paper px-2 py-1 text-xs"
                  />
                  <button type="button" onClick={addImage} className="rounded border border-line px-2 py-1 text-xs">
                    {t('form.addImage')}
                  </button>
                </>
              )}
              <ImageUploadButton
                folder="products"
                onUploaded={editingId ? addImageFromUrl : (url) => setNewProductImages((imgs) => [...imgs, url])}
                label={tCommon('uploadPhoto')}
                className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-line/30 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="rounded border border-line bg-paper p-3">
            <p className="text-xs font-medium text-muted">{t('promotions.title')}</p>
            {!editingId ? (
              <p className="mt-2 text-xs text-muted">{t('promotions.saveFirst')}</p>
            ) : (
              <>
                <ul className="mt-2 flex flex-col gap-2">
                  {(editingProduct?.promotions ?? []).map((promo) => (
                    <li key={promo.id} className="rounded border border-line bg-panel p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">
                          {promo.priceTierType.label} —{' '}
                          {promo.discountType === 'PERCENT' ? `${promo.discountValue} %` : `${promo.discountValue} DA`}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => togglePromotionActive(promo)}
                            className={promo.isActive ? 'text-teal' : 'text-muted'}
                          >
                            {t('promotions.active')}
                          </button>
                          <button type="button" onClick={() => removePromotion(promo.id)} className="text-red-600 hover:underline">
                            {tCommon('delete')}
                          </button>
                        </div>
                      </div>
                      <p className="mt-0.5 text-muted">
                        {new Date(promo.startDate).toLocaleDateString()} → {new Date(promo.endDate).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                  {(editingProduct?.promotions ?? []).length === 0 && <p className="text-xs text-muted">{t('promotions.none')}</p>}
                </ul>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted">{t('promotions.priceTier')}</span>
                    <select
                      value={promoForm.priceTierTypeId}
                      onChange={(e) => setPromoForm({ ...promoForm, priceTierTypeId: e.target.value })}
                      className="rounded border border-line bg-panel px-2 py-1"
                    >
                      <option value=""></option>
                      {priceTierTypes.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted">{t('promotions.discountType')}</span>
                    <select
                      value={promoForm.discountType}
                      onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value as 'PERCENT' | 'AMOUNT' })}
                      className="rounded border border-line bg-panel px-2 py-1"
                    >
                      <option value="PERCENT">{t('promotions.percent')}</option>
                      <option value="AMOUNT">{t('promotions.amount')}</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted">{t('promotions.value')}</span>
                    <input
                      type="number"
                      value={promoForm.discountValue}
                      onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })}
                      className="rounded border border-line bg-panel px-2 py-1"
                    />
                  </label>
                  <div />
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted">{t('promotions.startDate')}</span>
                    <input
                      type="date"
                      value={promoForm.startDate}
                      onChange={(e) => setPromoForm({ ...promoForm, startDate: e.target.value })}
                      className="rounded border border-line bg-panel px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted">{t('promotions.endDate')}</span>
                    <input
                      type="date"
                      value={promoForm.endDate}
                      onChange={(e) => setPromoForm({ ...promoForm, endDate: e.target.value })}
                      className="rounded border border-line bg-panel px-2 py-1"
                    />
                  </label>
                </div>
                <button type="button" onClick={addPromotion} className="mt-2 w-full rounded bg-accent px-2 py-1.5 text-xs font-medium text-white">
                  {t('promotions.add')}
                </button>
              </>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded bg-accent px-3 py-2 text-sm font-medium text-white">
              {tCommon('save')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                  setNewProductImages([]);
                }}
                className="rounded border border-line px-3 py-2 text-sm"
              >
                {tCommon('cancel')}
              </button>
            )}
          </div>
        </div>
      </form>

      {viewingImages && (
        <ImageLightbox
          images={viewingImages.images}
          startIndex={viewingImages.startIndex}
          title={t('form.images')}
          onClose={() => setViewingImages(null)}
        />
      )}
    </div>
  );
}

const FIELD_LABEL_KEYS: Record<string, string> = {
  sku: 'form.sku',
  categoryId: 'form.category',
  manufacturerId: 'form.manufacturer',
  brand: 'form.brand',
  nameFr: 'form.nameFr',
  nameAr: 'form.nameAr',
  nameEn: 'form.nameEn',
  packagingUnitId: 'form.packagingUnit',
  unitsPerPackage: 'form.unitsPerPackage',
  costPrice: 'form.costPrice',
  currentStock: 'form.currentStock',
  stockMin: 'form.stockMin',
  isActive: 'form.isActive',
  isNew: 'form.isNew',
  isFeatured: 'form.isFeatured',
};

function formatChangeValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  return String(v);
}

function describeChange(change: LastChange, t: ReturnType<typeof useTranslations>): string {
  if (change.kind === 'price') {
    return `${change.label ?? t('form.priceFactory')}: ${formatChangeValue(change.oldValue)} → ${change.newValue} DA`;
  }
  if (!change.field) return t('createdLabel' as never);
  return change.field
    .split(',')
    .map((f) => {
      const labelKey = FIELD_LABEL_KEYS[f];
      const label = labelKey ? t(labelKey as never) : f;
      const oldV = (change.oldValue as Record<string, unknown> | null)?.[f];
      const newV = (change.newValue as Record<string, unknown> | null)?.[f];
      return `${label}: ${formatChangeValue(oldV)} → ${formatChangeValue(newV)}`;
    })
    .join(', ');
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-line bg-paper px-3 py-2"
      />
    </label>
  );
}
