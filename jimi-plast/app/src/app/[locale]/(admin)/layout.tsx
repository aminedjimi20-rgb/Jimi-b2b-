'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { NotificationBell } from '@/components/notification-bell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { locale } = useParams<{ locale: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');

  useEffect(() => {
    if (!loading && !user) router.replace(`/${locale}/login`);
  }, [loading, user, locale, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted">…</div>;
  }

  const links = [
    { href: `/${locale}/dashboard`, label: t('dashboard') },
    { href: `/${locale}/catalog`, label: t('catalog') },
    ...(user.permissions.includes('catalog.manage')
      ? [
          { href: `/${locale}/products`, label: t('products') },
          { href: `/${locale}/categories`, label: t('categories') },
        ]
      : []),
    ...(user.permissions.includes('customers.manage')
      ? [{ href: `/${locale}/customers`, label: t('customers') }]
      : []),
    ...(user.permissions.includes('vouchers.create')
      ? [{ href: `/${locale}/vouchers`, label: t('vouchers') }]
      : []),
    ...(user.permissions.includes('suppliers.view')
      ? [
          { href: `/${locale}/manufacturers`, label: t('manufacturers') },
          { href: `/${locale}/purchases`, label: t('purchases') },
        ]
      : []),
    ...(user.permissions.includes('stock.manage')
      ? [{ href: `/${locale}/stock`, label: t('stock') }]
      : []),
    ...(user.permissions.includes('returns.manage')
      ? [{ href: `/${locale}/returns`, label: t('returns') }]
      : []),
    ...(user.permissions.includes('transport.manage')
      ? [{ href: `/${locale}/transport`, label: t('transport') }]
      : []),
    ...(user.permissions.includes('requests.manage')
      ? [
          { href: `/${locale}/product-requests`, label: t('productRequests') },
          { href: `/${locale}/negotiations`, label: t('negotiations') },
        ]
      : []),
    ...(!user.permissions.includes('customers.manage') && ['wholesaler', 'retailer'].includes(user.role.key)
      ? [{ href: `/${locale}/account`, label: t('myAccount') }]
      : []),
    ...(user.permissions.includes('users.manage')
      ? [
          { href: `/${locale}/requests`, label: t('requests') },
          { href: `/${locale}/users`, label: t('users') },
        ]
      : []),
    ...(user.permissions.includes('trash.restore') ? [{ href: `/${locale}/trash`, label: t('trash') }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-60 flex-col border-e border-line bg-panel p-4">
        <div className="mb-8 font-mono text-sm font-semibold uppercase tracking-wider text-accent">
          JIMI PLAST
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-3 py-2 text-sm ${
                pathname === link.href ? 'bg-accent/10 font-medium text-accent' : 'text-ink hover:bg-line/40'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line pt-4">
          <p className="truncate text-sm font-medium text-ink">{user.fullName}</p>
          <p className="truncate text-xs text-muted">{user.role.name}</p>
          <button onClick={logout} className="mt-3 text-xs text-accent hover:underline">
            {t('logout')}
          </button>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-line bg-panel px-6 py-3">
          <NotificationBell />
          <LocaleSwitcher current={locale} />
          <button onClick={logout} className="text-xs text-accent hover:underline">
            {t('logout')}
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
