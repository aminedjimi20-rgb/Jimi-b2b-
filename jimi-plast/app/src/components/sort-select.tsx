'use client';

import { useTranslations } from 'next-intl';

export type SortMode =
  | 'name_asc'
  | 'name_desc'
  | 'newest'
  | 'oldest'
  | 'count_desc'
  | 'count_asc'
  | 'price_desc'
  | 'price_asc'
  | 'manual';

const LABEL_KEYS: Record<SortMode, string> = {
  name_asc: 'nameAsc',
  name_desc: 'nameDesc',
  newest: 'newest',
  oldest: 'oldest',
  count_desc: 'countDesc',
  count_asc: 'countAsc',
  price_desc: 'priceDesc',
  price_asc: 'priceAsc',
  manual: 'manual',
};

export function SortSelect({
  value,
  onChange,
  options,
}: {
  value: SortMode;
  onChange: (v: SortMode) => void;
  options: SortMode[];
}) {
  const t = useTranslations('common.sort');
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{t('label')}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortMode)}
        className="rounded border border-line bg-panel px-3 py-2 text-sm"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {t(LABEL_KEYS[opt] as never)}
          </option>
        ))}
      </select>
    </label>
  );
}
