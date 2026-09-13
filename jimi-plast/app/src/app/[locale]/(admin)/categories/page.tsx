'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Category {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  parentId: string | null;
  _count: { products: number };
}

const EMPTY_FORM = { slug: '', nameFr: '', nameAr: '', nameEn: '', parentId: '' };

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const { token } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.get<Category[]>('/categories').then(setCategories);
  }

  useEffect(reload, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      slug: form.slug,
      nameFr: form.nameFr,
      nameAr: form.nameAr || undefined,
      nameEn: form.nameEn || undefined,
      parentId: form.parentId || undefined,
    };
    try {
      if (editingId) {
        await api.put(`/categories/${editingId}`, payload, token);
      } else {
        await api.post('/categories', payload, token);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      reload();
    } catch {
      setError(tCommon('error'));
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setForm({
      slug: c.slug,
      nameFr: c.nameFr,
      nameAr: c.nameAr ?? '',
      nameEn: c.nameEn ?? '',
      parentId: c.parentId ?? '',
    });
  }

  async function remove(c: Category) {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.delete(`/categories/${c.id}`, token);
      reload();
    } catch {
      setError(tCommon('error'));
    }
  }

  const nameOf = (c: Category) => c.nameFr;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-line/30 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 text-start">{t('columns.name')}</th>
                <th className="px-4 py-2 text-start">{t('columns.slug')}</th>
                <th className="px-4 py-2 text-start">{t('columns.parent')}</th>
                <th className="px-4 py-2 text-start">{t('columns.products')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-line">
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
          <Field label={t('form.slug')} value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          <Field label={t('form.nameFr')} value={form.nameFr} onChange={(v) => setForm({ ...form, nameFr: v })} />
          <Field label={t('form.nameAr')} value={form.nameAr} onChange={(v) => setForm({ ...form, nameAr: v })} />
          <Field label={t('form.nameEn')} value={form.nameEn} onChange={(v) => setForm({ ...form, nameEn: v })} />
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
