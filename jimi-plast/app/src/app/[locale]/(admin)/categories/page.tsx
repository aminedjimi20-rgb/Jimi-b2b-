'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { SortSelect, type SortMode } from '@/components/sort-select';

interface Category {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  _count: { products: number };
}

type CategoryType = 'root' | 'sub';

const EMPTY_FORM = { slug: '', nameFr: '', nameAr: '', nameEn: '', parentId: '' };

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const { token } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formType, setFormType] = useState<CategoryType>('root');
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.get<Category[]>('/categories').then(setCategories);
  }

  useEffect(reload, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.nameFr.toLowerCase().includes(q) ||
        c.nameAr?.toLowerCase().includes(q) ||
        c.nameEn?.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q),
    );
  }, [categories, search]);

  const sortedFiltered = useMemo(() => {
    if (sortMode === 'manual') return filtered;
    const arr = [...filtered];
    switch (sortMode) {
      case 'name_asc':
        arr.sort((a, b) => a.nameFr.localeCompare(b.nameFr));
        break;
      case 'name_desc':
        arr.sort((a, b) => b.nameFr.localeCompare(a.nameFr));
        break;
      case 'newest':
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'count_desc':
        arr.sort((a, b) => b._count.products - a._count.products);
        break;
      case 'count_asc':
        arr.sort((a, b) => a._count.products - b._count.products);
        break;
    }
    return arr;
  }, [filtered, sortMode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (formType === 'sub' && !form.parentId) {
      setError(t('form.chooseParent'));
      return;
    }
    const payload = {
      slug: slugify(form.slug || form.nameFr),
      nameFr: form.nameFr,
      nameAr: form.nameAr || undefined,
      nameEn: form.nameEn || undefined,
      parentId: formType === 'sub' ? form.parentId : undefined,
    };
    try {
      if (editingId) {
        await api.put(`/categories/${editingId}`, payload, token);
      } else {
        await api.post('/categories', payload, token);
      }
      setForm(EMPTY_FORM);
      setFormType('root');
      setSlugTouched(false);
      setEditingId(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon('error'));
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setFormType(c.parentId ? 'sub' : 'root');
    setSlugTouched(true);
    setForm({
      slug: c.slug,
      nameFr: c.nameFr,
      nameAr: c.nameAr ?? '',
      nameEn: c.nameEn ?? '',
      parentId: c.parentId ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormType('root');
    setSlugTouched(false);
    setForm(EMPTY_FORM);
  }

  async function remove(c: Category) {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.delete(`/categories/${c.id}`, token);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon('error'));
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= sortedFiltered.length) return;
    const reordered = [...sortedFiltered];
    [reordered[index], reordered[otherIndex]] = [reordered[otherIndex], reordered[index]];

    await Promise.all(
      reordered.map((c, i) => {
        const newSortOrder = i * 10;
        if (c.sortOrder === newSortOrder) return Promise.resolve();
        return api.put(
          `/categories/${c.id}`,
          {
            slug: c.slug,
            nameFr: c.nameFr,
            nameAr: c.nameAr || undefined,
            nameEn: c.nameEn || undefined,
            parentId: c.parentId || undefined,
            sortOrder: newSortOrder,
          },
          token,
        );
      }),
    );
    reload();
  }

  const nameOf = (c: Category) => c.nameFr;
  const canReorder = search.trim() === '' && sortMode === 'manual';

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full max-w-xs rounded border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <SortSelect
              value={sortMode}
              onChange={setSortMode}
              options={['newest', 'oldest', 'name_asc', 'name_desc', 'count_desc', 'count_asc', 'manual']}
            />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-line/30 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-start">{t('columns.order')}</th>
                <th className="px-4 py-2 text-start">{t('columns.name')}</th>
                <th className="px-4 py-2 text-start">{t('columns.slug')}</th>
                <th className="px-4 py-2 text-start">{t('columns.parent')}</th>
                <th className="px-4 py-2 text-start">{t('columns.products')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((c, index) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={!canReorder || index === 0}
                        title={t('moveUp')}
                        className="rounded px-1 text-muted hover:text-accent disabled:opacity-20"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={!canReorder || index === sortedFiltered.length - 1}
                        title={t('moveDown')}
                        className="rounded px-1 text-muted hover:text-accent disabled:opacity-20"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-medium text-ink">{nameOf(c)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted">{c.slug}</td>
                  <td className="px-4 py-2 text-xs text-muted">
                    {categories.find((p) => p.id === c.parentId)?.nameFr ?? '—'}
                  </td>
                  <td className="px-4 py-2 tabular">{c._count.products}</td>
                  <td className="flex gap-2 px-4 py-2 text-end">
                    <button onClick={() => startEdit(c)} className="text-xs text-accent hover:underline">
                      {tCommon('edit')}
                    </button>
                    <button onClick={() => remove(c)} className="text-xs text-red-600 hover:underline">
                      {tCommon('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={onSubmit} className="w-full rounded-lg border border-line bg-panel p-4 lg:w-80">
        <h2 className="text-sm font-semibold text-ink">
          {editingId ? tCommon('edit') : t('addCategory')}
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('form.type')}</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formType === 'root'}
                  onChange={() => {
                    setFormType('root');
                    setForm({ ...form, parentId: '' });
                  }}
                />
                {t('form.typeRoot')}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={formType === 'sub'} onChange={() => setFormType('sub')} />
                {t('form.typeSub')}
              </label>
            </div>
          </div>

          {formType === 'sub' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{t('form.parent')}</span>
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="rounded border border-line bg-paper px-3 py-2"
              >
                <option value="">{t('none')}</option>
                {categories
                  .filter((c) => c.id !== editingId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameFr}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <Field
            label={t('form.nameFr')}
            value={form.nameFr}
            onChange={(v) => setForm({ ...form, nameFr: v, slug: slugTouched ? form.slug : slugify(v) })}
          />
          <Field label={t('form.nameAr')} value={form.nameAr} onChange={(v) => setForm({ ...form, nameAr: v })} />
          <Field label={t('form.nameEn')} value={form.nameEn} onChange={(v) => setForm({ ...form, nameEn: v })} />
          <Field
            label={t('form.slug')}
            value={form.slug}
            onChange={(v) => {
              setSlugTouched(true);
              setForm({ ...form, slug: v });
            }}
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded bg-accent px-3 py-2 text-sm font-medium text-white">
              {tCommon('save')}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="rounded border border-line px-3 py-2 text-sm">
                {tCommon('cancel')}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-line bg-paper px-3 py-2"
      />
    </label>
  );
}
