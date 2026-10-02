'use client';

import { usePathname, useRouter } from 'next/navigation';
import { locales, type Locale } from '@/i18n/routing';

const LABELS: Record<Locale, string> = { fr: 'FR', ar: 'العربية', en: 'EN' };

export function LocaleSwitcher({ current }: { current: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(locale: Locale) {
    const segments = pathname.split('/');
    segments[1] = locale;
    router.push(segments.join('/'));
  }

  return (
    <div className="flex gap-1 text-xs">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => switchTo(locale)}
          className={`rounded px-2 py-1 font-mono ${
            locale === current ? 'bg-accent text-white' : 'text-muted hover:bg-line/50'
          }`}
        >
          {LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
