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
}

/**
 * Vitrine de marque affichée en bas de la barre latérale sur toutes les
 * pages — badge d'ancienneté + logos des entreprises partenaires. Visible
 * par tous (client, employé, fabricant, admin), modifiable uniquement par
 * qui a settings.manage (l'admin).
 */
export function BrandingFooter() {
  const t = useTranslations('branding');
  const { token, hasPermission } = useAuth();
  const canManage = hasPermission('settings.manage');
  const [branding, setBranding] = useState<Branding | null>(null);
  const [editingYears, setEditingYears] = useState(false);
  const [yearsDraft, setYearsDraft] = useState('');

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

  if (!branding) return null;

  return (
    <div className="mb-3 flex flex-col items-center gap-3 border-t border-line pt-3">
      {/* Badge d'ancienneté */}
      <div className="relative flex flex-col items-center">
        <svg width="64" height="64" viewBox="0 0 64 64" className="drop-shadow-sm">
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
              className="w-10 rounded border border-line bg-paper text-center text-lg font-bold text-ink outline-none"
            />
          ) : (
            <span
              className={`text-xl font-bold leading-none text-ink ${canManage ? 'cursor-pointer' : ''}`}
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
      <p className="-mt-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted">{t('experienceLabel')}</p>

      {/* Logos partenaires */}
      {(branding.logos.length > 0 || canManage) && (
        <div className="flex w-full flex-col items-center gap-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">{t('partnersLabel')}</p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
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
        </div>
      )}
    </div>
  );
}
