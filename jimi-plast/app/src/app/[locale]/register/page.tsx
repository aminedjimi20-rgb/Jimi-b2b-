'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LocaleSwitcher } from '@/components/locale-switcher';

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  wilaya: string;
  businessName: string;
  requestedRoleKey: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  wilaya: '',
  businessName: '',
  requestedRoleKey: 'wholesaler',
  notes: '',
};

export default function RegisterPage() {
  const t = useTranslations('register');
  const { locale } = useParams<{ locale: string }>();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/register-request', form);
      setSubmitted(true);
    } catch {
      setError('Erreur lors de l’envoi de la demande');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border border-line bg-panel p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-accent">JIMI PLAST</span>
          <LocaleSwitcher current={locale} />
        </div>

        {submitted ? (
          <div className="py-8 text-center">
            <p className="text-lg font-medium text-teal">{t('success')}</p>
            <Link href={`/${locale}/login`} className="mt-4 inline-block text-sm text-accent hover:underline">
              {t('backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>

            <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('fullName')} value={form.fullName} onChange={(v) => update('fullName', v)} required />
              <Field label={t('phone')} value={form.phone} onChange={(v) => update('phone', v)} required />
              <Field
                label={t('email')}
                type="email"
                value={form.email}
                onChange={(v) => update('email', v)}
                required
              />
              <Field label={t('wilaya')} value={form.wilaya} onChange={(v) => update('wilaya', v)} />
              <Field
                label={t('address')}
                value={form.address}
                onChange={(v) => update('address', v)}
                className="sm:col-span-2"
              />
              <Field
                label={t('businessName')}
                value={form.businessName}
                onChange={(v) => update('businessName', v)}
                className="sm:col-span-2"
              />

              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-muted">{t('requestedRole')}</span>
                <select
                  value={form.requestedRoleKey}
                  onChange={(e) => update('requestedRoleKey', e.target.value)}
                  className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
                >
                  <option value="wholesaler">{t('roleWholesaler')}</option>
                  <option value="retailer">{t('roleRetailer')}</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-muted">{t('notes')}</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  rows={3}
                  className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
                />
              </label>

              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded bg-accent px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50 sm:col-span-2"
              >
                {t('submit')}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              <Link href={`/${locale}/login`} className="text-accent hover:underline">
                {t('backToLogin')}
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ''}`}>
      <span className="text-muted">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
      />
    </label>
  );
}
