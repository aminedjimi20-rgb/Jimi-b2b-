'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';
import { SortSelect, type SortMode } from '@/components/sort-select';

interface Role {
  key: string;
  name: string;
}
interface CustomerRow {
  id: string;
  businessName: string | null;
  address: string | null;
  wilaya: string | null;
  creditLimit: number;
  createdAt: string;
  balance: number;
  user: { id: string; fullName: string; avatarUrl: string | null; phone: string | null; role: Role };
}

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  email: '',
  roleKey: 'wholesaler',
  initialPassword: '',
  businessName: '',
  address: '',
  wilaya: '',
  creditLimit: '0',
};

export default function CustomersPage() {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const { token } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  function reload() {
    api.get<CustomerRow[]>('/customers', token).then(setCustomers);
  }

  async function setCustomerAvatar(userId: string, avatarUrl: string) {
    await api.put(`/users/${userId}/avatar`, { avatarUrl }, token);
    reload();
  }

  useEffect(() => {
    if (!token) return;
    reload();
    api.get<Role[]>('/roles', token).then((rows) => setRoles(rows.filter((r) => !['admin', 'employee'].includes(r.key))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.user.fullName.toLowerCase().includes(q) ||
        c.businessName?.toLowerCase().includes(q) ||
        c.user.phone?.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    switch (sortMode) {
      case 'name_asc':
        arr.sort((a, b) => a.user.fullName.localeCompare(b.user.fullName));
        break;
      case 'name_desc':
        arr.sort((a, b) => b.user.fullName.localeCompare(a.user.fullName));
        break;
      case 'oldest':
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'newest':
      default:
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return arr;
  }, [filtered, sortMode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api.put(
          `/customers/${editingId}`,
          {
            fullName: form.fullName,
            phone: form.phone,
            businessName: form.businessName || undefined,
            address: form.address || undefined,
            wilaya: form.wilaya || undefined,
            creditLimit: Number(form.creditLimit) || 0,
          },
          token,
        );
      } else {
        await api.post(
          '/customers',
          {
            fullName: form.fullName,
            phone: form.phone,
            email: form.email,
            roleKey: form.roleKey,
            initialPassword: form.initialPassword,
            businessName: form.businessName || undefined,
            address: form.address || undefined,
            wilaya: form.wilaya || undefined,
          },
          token,
        );
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon('error'));
    }
  }

  function startEdit(c: CustomerRow) {
    setEditingId(c.id);
    setError(null);
    setShowForm(true);
    setForm({
      ...EMPTY_FORM,
      fullName: c.user.fullName,
      phone: c.user.phone ?? '',
      businessName: c.businessName ?? '',
      address: c.address ?? '',
      wilaya: c.wilaya ?? '',
      creditLimit: String(c.creditLimit ?? 0),
    });
  }

  function cancelForm() {
    setEditingId(null);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function toggleCreateForm() {
    if (showForm && !editingId) {
      cancelForm();
    } else {
      setShowForm(true);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setError(null);
    }
  }

  async function remove(c: CustomerRow) {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.delete(`/customers/${c.id}`, token);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon('error'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <SortSelect value={sortMode} onChange={setSortMode} options={['newest', 'oldest', 'name_asc', 'name_desc']} />
          <button onClick={toggleCreateForm} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white">
            {t('addCustomer')}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-3">
          <Field label={t('form.fullName')} value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
          <Field label={t('form.phone')} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          {!editingId && (
            <>
              <Field label={t('form.email')} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t('form.roleKey')}</span>
                <select
                  value={form.roleKey}
                  onChange={(e) => setForm({ ...form, roleKey: e.target.value })}
                  className="rounded border border-line bg-paper px-3 py-2"
                >
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label={t('form.initialPassword')}
                value={form.initialPassword}
                onChange={(v) => setForm({ ...form, initialPassword: v })}
              />
            </>
          )}
          <Field label={t('form.businessName')} value={form.businessName} onChange={(v) => setForm({ ...form, businessName: v })} />
          <Field label={t('form.address')} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label={t('form.wilaya')} value={form.wilaya} onChange={(v) => setForm({ ...form, wilaya: v })} />
          {editingId && (
            <Field
              label={t('form.creditLimit')}
              value={form.creditLimit}
              onChange={(v) => setForm({ ...form, creditLimit: v })}
            />
          )}

          {error && <p className="text-xs text-red-600 sm:col-span-3">{error}</p>}
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className="flex-1 rounded bg-accent px-3 py-2 text-sm font-medium text-white">
              {tCommon('save')}
            </button>
            <button type="button" onClick={cancelForm} className="rounded border border-line px-3 py-2 text-sm">
              {tCommon('cancel')}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-line/30 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 text-start">{t('columns.name')}</th>
              <th className="px-4 py-2 text-start">{t('columns.business')}</th>
              <th className="px-4 py-2 text-start">{t('columns.phone')}</th>
              <th className="px-4 py-2 text-start">{t('columns.role')}</th>
              <th className="px-4 py-2 text-start">{t('columns.balance')}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/${locale}/customers/${c.id}`)}
                className="cursor-pointer border-t border-line hover:bg-line/20"
              >
                <td className="px-4 py-2 font-medium text-ink">
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {c.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                        {c.user.fullName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span>{c.user.fullName}</span>
                    <ImageUploadButton
                      folder="customers"
                      label={tCommon('uploadPhoto')}
                      onUploaded={(url) => setCustomerAvatar(c.user.id, url)}
                      className="text-xs text-accent hover:underline"
                    />
                  </div>
                </td>
                <td className="px-4 py-2 text-muted">{c.businessName ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{c.user.phone}</td>
                <td className="px-4 py-2 text-xs text-muted">{c.user.role.name}</td>
                <td className={`px-4 py-2 tabular font-medium ${c.balance > 0 ? 'text-accent' : 'text-teal'}`}>
                  {c.balance.toLocaleString()} DA
                </td>
                <td className="px-4 py-2 text-end" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(c)} className="text-xs text-accent hover:underline">
                      {tCommon('edit')}
                    </button>
                    <button onClick={() => remove(c)} className="text-xs text-red-600 hover:underline">
                      {tCommon('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
