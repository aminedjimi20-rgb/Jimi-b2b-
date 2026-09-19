'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { uploadImage } from '@/lib/cloudinary';

interface Props {
  folder: string;
  onUploaded: (url: string) => void;
  label: string;
  className?: string;
}

/**
 * Bouton générique de sélection + envoi d'image. Propose un choix explicite
 * Caméra / Galerie au clic : avec `capture` seul, certains navigateurs
 * mobiles ouvrent l'appareil photo directement sans jamais proposer la
 * galerie. Réutilisé partout où un champ "photo" ou "logo" existe : avatar
 * utilisateur, logo fabricant, photo chauffeur, photos produit, pièces
 * jointes de bon.
 */
export function ImageUploadButton({ folder, onUploaded, label, className }: Props) {
  const tCommon = useTranslations('common');
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setMenuOpen(false);
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file, folder);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={uploading}
        className={
          className ??
          'rounded border border-line px-3 py-2 text-sm text-ink hover:bg-line/30 disabled:opacity-50'
        }
      >
        {uploading ? '…' : label}
      </button>

      {menuOpen && (
        <div className="absolute start-0 top-full z-20 mt-1 flex w-max flex-col overflow-hidden rounded border border-line bg-panel shadow-lg">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-3 py-2 text-start text-xs text-ink hover:bg-line/30"
          >
            📷 {tCommon('camera')}
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="border-t border-line px-3 py-2 text-start text-xs text-ink hover:bg-line/30"
          >
            🖼️ {tCommon('gallery')}
          </button>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
