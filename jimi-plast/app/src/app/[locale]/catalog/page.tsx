'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { LocaleSwitcher } from '@/components/locale-switcher';

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

interface Product {
  id: string;
  sku: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  brand: string | null;
  category: { nameFr: string };
  packagingUnit: { label: string; labelPlural: string };
  images: { url: string; isPrimary: boolean }[];
  isNew: boolean;
  isFeatured: boolean;
  availability: 'IN_STOCK' | 'OUT_OF_STOCK';
  prices: Price[];
  hasPromotion: boolean;
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
  const { user, token } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState('priority');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyOnSale, setOnlyOnSale] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);

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
      })
      .finally(() => setLoading(false));
  }, [search, categoryId, sort, onlyInStock, onlyOnSale, onlyNew, token]);

  const topCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b border-line bg-panel px-6 py-4">
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
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>

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
        </div>

        {!loading && products.length === 0 && (
          <p className="mt-10 text-center text-muted">{t('noResults')}</p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const mainPrice = p.prices[0];
            return (
              <div key={p.id} className="flex flex-col rounded-lg border border-line bg-panel p-3 shadow-sm">
                <div className="relative mb-2 flex aspect-square items-center justify-center rounded bg-paper text-muted">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0].url} alt={localizedName(p, locale)} className="h-full w-full rounded object-cover" />
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
                <p className="text-xs text-muted">{p.category.nameFr}</p>
                <p className="text-xs text-muted">
                  {p.packagingUnit.label}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  {mainPrice ? (
                    <div className="font-mono text-sm font-semibold text-ink">
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
              </div>
            );
          })}
        </div>

        {!loading && (
          <p className="mt-6 text-center text-xs text-muted">{total} produits</p>
        )}
      </div>
    </div>
  );
}
