'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, ApiError } from '@/lib/auth-context';
import { LocaleSwitcher } from '@/components/locale-switcher';

export default function LoginPage() {
  const t = useTranslations('login');
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const { user, loading, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Revenir sur /login (bouton précédent du navigateur, onglet rouvert...)
    // alors que la session est toujours valide ne doit pas réafficher le
    // formulaire — sinon l'utilisateur croit avoir été déconnecté.
    if (!loading && user) router.replace(`/${locale}/dashboard`);
  }, [loading, user, locale, router]);

  if (loading || user) {
    return <div className="flex min-h-screen items-center justify-center text-muted">…</div>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      // status 0 = serveur endormi/en train de démarrer (voir api.ts) : le
      // message explique la situation plutôt que de laisser croire à un
      // mot de passe incorrect.
      setError(err instanceof ApiError && err.status !== 0 ? t('error') : (err as Error).message || 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-accent">JIMI PLAST</span>
          <LocaleSwitcher current={locale} />
        </div>
        <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('email')}</span>
            <input
              type="email"
              required
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('password')}</span>
            <input
              type="password"
              required
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded bg-accent px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {t('submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t('noAccount')}{' '}
          <Link href={`/${locale}/register`} className="text-accent hover:underline">
            {t('registerLink')}
          </Link>
        </p>
      </div>
    </main>
  );
}
