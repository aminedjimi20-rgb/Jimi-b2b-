'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ImageUploadButton } from '@/components/image-upload-button';

interface PartnerLogo {
  id: string;
  imageUrl: string;
}
interface Branding {
  experienceYears: number;
  logos: PartnerLogo[];
  companyLegalName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyRC: string | null;
  companyNIF: string | null;
  companyNIS: string | null;
  companyAI: string | null;
}

const COMPANY_FIELDS = [
  { key: 'companyLegalName', labelKey: 'companyLegalName' },
  { key: 'companyAddress', labelKey: 'companyAddress' },
  { key: 'companyPhone', labelKey: 'companyPhone' },
  { key: 'companyRC', labelKey: 'companyRC' },
  { key: 'companyNIF', labelKey: 'companyNIF' },
  { key: 'companyNIS', labelKey: 'companyNIS' },
  { key: 'companyAI', labelKey: 'companyAI' },
] as const;

/**
 * Vitrine de marque affichée en bas de la barre latérale sur toutes les
 * pages — badge d'ancienneté + logos des entreprises partenaires. Visible
 * par tous (client, employé, fabricant, admin), modifiable uniquement par
 * qui a settings.manage (l'admin).
 */
export function BrandingFooter({ variant = 'sidebar' }: { variant?: 'sidebar' | 'bar' }) {
  const t = useTranslations('branding');
  const { token, hasPermission } = useAuth();
  const canManage = hasPermission('settings.manage');
  const [branding, setBranding] = useState<Branding | null>(null);
  const [editingYears, setEditingYears] = useState(false);
  const [yearsDraft, setYearsDraft] = useState('');
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyDraft, setCompanyDraft] = useState<Record<string, string>>({});
  const [savingCompany, setSavingCompany] = useState(false);

  function reload() {
    if (token) api.get<Branding>('/branding', token).then(setBranding);
  }
  useEffect(reload, [token]);

  async function saveYears() {
    const n = Number(yearsDraft);
    if (!Number.isFinite(n) || n < 0) return;
    await api.put('/branding/experience', { experienceYears: n }, token);
    setEditingYears(false);
    reload();
  }

  async function onLogoUploaded(url: string) {
    await api.post('/branding/logos', { imageUrl: url }, token);
    reload();
  }

  async function removeLogo(id: string) {
    await api.delete(`/branding/logos/${id}`, token);
    reload();
  }

  function openCompanyEditor() {
    if (!branding) return;
    setCompanyDraft(
      Object.fromEntries(COMPANY_FIELDS.map((f) => [f.key, branding[f.key] ?? ''])),
    );
    setEditingCompany(true);
  }

  async function saveCompany() {
    setSavingCompany(true);
    try {
      await api.put('/branding/company', companyDraft, token);
      setEditingCompany(false);
      reload();
    } finally {
      setSavingCompany(false);
    }
  }

  if (!branding) return null;

  const badgeSize = variant === 'bar' ? 44 : 64;
  const badge = (
    <div className="relative flex shrink-0 flex-col items-center">
      <svg width={badgeSize} height={badgeSize} viewBox="0 0 64 64" className="drop-shadow-sm">
        <defs>
          <linearGradient id="branding-badge-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-accent, #f97316)" />
            <stop offset="100%" stopColor="var(--color-teal, #14b8a6)" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="29" fill="none" stroke="url(#branding-badge-ring)" strokeWidth="2.5" />
        <circle cx="32" cy="32" r="24" className="fill-panel" />
        {/* petits traits façon laurier, gauche/droite */}
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${32 + side * 24}, 32) scale(${side}, 1)`}>
            {[-14, -7, 0, 7, 14].map((y) => (
              <line key={y} x1="0" y1={y} x2="7" y2={y - 2} stroke="url(#branding-badge-ring)" strokeWidth="1.5" strokeLinecap="round" />
            ))}
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {editingYears ? (
          <input
            autoFocus
            type="number"
            min={0}
            value={yearsDraft}
            onChange={(e) => setYearsDraft(e.target.value)}
            onBlur={saveYears}
            onKeyDown={(e) => e.key === 'Enter' && saveYears()}
            className={`rounded border border-line bg-paper text-center font-bold text-ink outline-none ${variant === 'bar' ? 'w-9 text-base' : 'w-10 text-lg'}`}
          />
        ) : (
          <span
            className={`font-bold leading-none text-ink ${variant === 'bar' ? 'text-base' : 'text-xl'} ${canManage ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (!canManage) return;
              setYearsDraft(String(branding.experienceYears));
              setEditingYears(true);
            }}
          >
            {branding.experienceYears}
          </span>
        )}
      </div>
    </div>
  );

  const logoStrip = (
    <div className={`flex flex-wrap items-center gap-1.5 ${variant === 'bar' ? '' : 'justify-center'}`}>
      {branding.logos.map((logo) => (
        <div key={logo.id} className="group relative h-8 w-8 shrink-0 overflow-hidden rounded border border-line bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.imageUrl} alt="" className="h-full w-full object-contain" />
          {canManage && (
            <button
              onClick={() => removeLogo(logo.id)}
              className="absolute inset-0 hidden items-center justify-center bg-black/60 text-xs text-white group-hover:flex"
              aria-label={t('removeLogo')}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {canManage && (
        <ImageUploadButton
          folder="partner-logos"
          label="+"
          onUploaded={onLogoUploaded}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-dashed border-line text-sm text-muted hover:border-accent hover:text-accent"
        />
      )}
    </div>
  );

  if (variant === 'bar') {
    if (branding.logos.length === 0 && !canManage) return null;
    return (
      <div className="border-b border-line bg-panel/60 px-6 py-2">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {badge}
            <span className="text-[10px] font-medium uppercase leading-tight tracking-wide text-muted">
              {t('experienceLabel')}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-muted">{t('partnersLabel')}</span>
          {logoStrip}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-col items-center gap-3 border-t border-line pt-3">
      {badge}
      <p className="-mt-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted">{t('experienceLabel')}</p>

      {/* Logos partenaires */}
      {(branding.logos.length > 0 || canManage) && (
        <div className="flex w-full flex-col items-center gap-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">{t('partnersLabel')}</p>
          {logoStrip}
        </div>
      )}

      {canManage && (
        <button onClick={openCompanyEditor} className="text-[10px] text-accent hover:underline">
          {t('companyInfoLink')}
        </button>
      )}

      {editingCompany && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded border border-line bg-panel p-4 shadow-lg">
            <p className="mb-3 text-sm font-semibold text-ink">{t('companyInfoLink')}</p>
            <div className="flex flex-col gap-2">
              {COMPANY_FIELDS.map((f) => (
                <input
                  key={f.key}
                  value={companyDraft[f.key] ?? ''}
                  onChange={(e) => setCompanyDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={t(f.labelKey)}
                  className="rounded border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                />
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setEditingCompany(false)} className="rounded border border-line px-3 py-1.5 text-xs text-ink hover:bg-line/30">
                {t('cancel')}
              </button>
              <button
                onClick={saveCompany}
                disabled={savingCompany}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
