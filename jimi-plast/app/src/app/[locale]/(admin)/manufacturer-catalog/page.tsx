'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';

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
  category: CategoryRef;
  packagingUnit: { label: string; labelPlural: string };
  unitsPerPackage: number;
  images: { url: string; isPrimary: boolean }[];
  availability: 'IN_STOCK' | 'OUT_OF_STOCK';
}

const localizedName = (item: { nameFr: string; nameAr?: string | null; nameEn?: string | null }, locale: string) => {
  if (locale === 'ar' && item.nameAr) return item.nameAr;
  if (locale === 'en' && item.nameEn) return item.nameEn;
  return item.nameFr;
};

export default function ManufacturerCatalogPage() {
  const t = useTranslations('manufacturers');
  const tCatalog = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const { locale } = useParams<{ locale: string }>();
  const { token } = useAuth();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<{ items: Product[] }>('/manufacturers/me/catalog', token)
      .then((res) => setProducts(res.items))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) setDenied(true);
        else setProducts([]);
      });
  }, [token]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t('myCatalog.title')}</h1>

      {denied && <p className="text-sm text-muted">{t('myCatalog.denied')}</p>}

      {!denied && products === null && <p className="text-muted">{tCommon('loading')}</p>}

      {!denied && products !== null && products.length === 0 && (
        <p className="text-sm text-muted">{t('myCatalog.empty')}</p>
      )}

      {!denied && products !== null && products.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <div key={p.id} className="flex flex-col rounded-lg border border-line bg-panel p-3 shadow-sm">
              <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded bg-paper text-muted">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0].url} alt={localizedName(p, locale)} className="h-full w-full rounded object-cover" />
                ) : (
                  <span className="text-3xl">📦</span>
                )}
              </div>
              <p className="line-clamp-2 text-sm font-medium text-ink">{localizedName(p, locale)}</p>
              <p className="text-xs text-muted">
                {p.category.parent ? `${localizedName(p.category.parent, locale)} › ` : ''}
                {localizedName(p.category, locale)}
              </p>
              <p className="text-xs font-medium text-accent">
                {tCatalog('piecesPerPackage', { count: p.unitsPerPackage, unit: p.packagingUnit.label })}
              </p>
              <span
                className={`mt-2 w-fit rounded-full px-2 py-0.5 text-[10px] ${
                  p.availability === 'IN_STOCK' ? 'bg-teal/15 text-teal' : 'bg-red-100 text-red-600'
                }`}
              >
                {p.availability === 'IN_STOCK' ? tCatalog('inStock') : tCatalog('outOfStock')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
