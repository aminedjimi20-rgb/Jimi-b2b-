'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';

interface Category {
  id: string;
  nameFr: string;
}
interface PackagingUnit {
  id: string;
  key: string;
  label: string;
}
interface PriceTierType {
  id: string;
  key: string;
  label: string;
}
interface FullProduct {
  id: string;
  sku: string;
  categoryId: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  brand: string | null;
  packagingUnitId: string;
  unitsPerPackage: number;
  costPrice: string | null;
  currentStock: number;
  stockMin: number;
  isNew: boolean;
  isFeatured: boolean;
  isActive: boolean;
  category: { nameFr: string };
  images: { id: string; url: string; isPrimary: boolean }[];
  prices: { priceTierType: PriceTierType; price: string }[];
}

const EMPTY_FORM = {
  sku: '',
  categoryId: '',
  nameFr: '',
  nameAr: '',
  nameEn: '',
  brand: '',
  packagingUnitId: '',
  unitsPerPackage: '1',
  costPrice: '',
  currentStock: '0',
  stockMin: '0',
  isNew: false,
  isFeatured: false,
  isActive: true,
  priceFactory: '',
  priceWholesale: '',
  priceRetail: '',
};

export default function ProductsAdminPage() {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  const [products, setProducts] = useState<FullProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packagingUnits, setPackagingUnits] = useState<PackagingUnit[]>([]);
  const [priceTierTypes, setPriceTierTypes] = useState<PriceTierType[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [appliedEditParam, setAppliedEditParam] = useState<string | null>(null);

  function reloadProducts() {
    api
      .get<{ items: { id: string }[] }>('/products?pageSize=100', token)
      .then((res) => Promise.all(res.items.map((p) => api.get<FullProduct>(`/products/${p.id}/full`, token))))
      .then(setProducts);
  }

  useEffect(() => {
    if (!token) return;
    reloadProducts();
    api.get<Category[]>('/categories').then(setCategories);
    api.get<PackagingUnit[]>('/catalog-settings/packaging-units').then(setPackagingUnits);
    api.get<PriceTierType[]>('/catalog-settings/price-tier-types').then(setPriceTierTypes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      nameFr: form.nameFr,
      nameAr: form.nameAr || undefined,
      nameEn: form.nameEn || undefined,
      brand: form.brand || undefined,
      packagingUnitId: form.packagingUnitId,
      unitsPerPackage: Number(form.unitsPerPackage) || 1,
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      currentStock: Number(form.currentStock) || 0,
      stockMin: Number(form.stockMin) || 0,
      isNew: form.isNew,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
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
        await api.post('/products', payload, token);
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
    const priceOf = (key: string) => p.prices.find((pr) => pr.priceTierType.key === key)?.price ?? '';
    setForm({
      sku: p.sku,
      categoryId: p.categoryId,
      nameFr: p.nameFr,
      nameAr: p.nameAr ?? '',
      nameEn: p.nameEn ?? '',
      brand: p.brand ?? '',
      packagingUnitId: p.packagingUnitId,
      unitsPerPackage: String(p.unitsPerPackage),
      costPrice: p.costPrice ?? '',
      currentStock: String(p.currentStock),
      stockMin: String(p.stockMin),
      isNew: p.isNew,
      isFeatured: p.isFeatured,
      isActive: p.isActive,
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

  const editingProduct = products.find((p) => p.id === editingId);

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-line/30 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-start">{t('columns.sku')}</th>
                <th className="px-4 py-2 text-start">{t('columns.name')}</th>
                <th className="px-4 py-2 text-start">{t('columns.category')}</th>
                <th className="px-4 py-2 text-start">{t('columns.stock')}</th>
                <th className="px-4 py-2 text-start">{t('columns.status')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={`border-t border-line ${editingId === p.id ? 'bg-accent/5' : ''}`}>
                  <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-2 font-medium text-ink">{p.nameFr}</td>
                  <td className="px-4 py-2 text-xs text-muted">{p.category.nameFr}</td>
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
                  <td className="flex gap-2 px-4 py-2 text-end">
                    <button onClick={() => startEdit(p)} className="text-xs text-accent hover:underline">
                      {tCommon('edit')}
                    </button>
                    <button onClick={() => remove(p)} className="text-xs text-red-600 hover:underline">
                      {tCommon('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <Field
              label={t('form.currentStock')}
              type="number"
              value={form.currentStock}
              onChange={(v) => setForm({ ...form, currentStock: v })}
            />
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
          </div>

          {editingProduct && (
            <div>
              <p className="text-xs font-medium text-muted">{t('form.images')}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {editingProduct.images.map((img) => (
                  <div key={img.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-14 w-14 rounded object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 rounded border border-line bg-paper px-2 py-1 text-xs"
                />
                <button type="button" onClick={addImage} className="rounded border border-line px-2 py-1 text-xs">
                  {t('form.addImage')}
                </button>
                <ImageUploadButton
                  folder="products"
                  onUploaded={addImageFromUrl}
                  label={tCommon('uploadPhoto')}
                  className="rounded border border-line px-2 py-1 text-xs text-ink hover:bg-line/30 disabled:opacity-50"
                />
              </div>
            </div>
          )}

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
                }}
                className="rounded border border-line px-3 py-2 text-sm"
              >
                {tCommon('cancel')}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
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
