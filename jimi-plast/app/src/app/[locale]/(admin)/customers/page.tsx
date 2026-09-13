'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';

interface Role {
  key: string;
  name: string;
}
interface CustomerRow {
  id: string;
  businessName: string | null;
  wilaya: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/customers', form, token);
      setForm(EMPTY_FORM);
      setShowForm(false);
      reload();
    } catch {
      setError(tCommon('error'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          {t('addCustomer')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-3">
          <Field label={t('form.fullName')} value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
          <Field label={t('form.phone')} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
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
          <Field label={t('form.businessName')} value={form.businessName} onChange={(v) => setForm({ ...form, businessName: v })} />
          <Field label={t('form.address')} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label={t('form.wilaya')} value={form.wilaya} onChange={(v) => setForm({ ...form, wilaya: v })} />

          {error && <p className="text-xs text-red-600 sm:col-span-3">{error}</p>}
          <button type="submit" className="rounded bg-accent px-3 py-2 text-sm font-medium text-white sm:col-span-3">
            {tCommon('save')}
          </button>
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
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
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
