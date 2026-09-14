'use client';

import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/cloudinary';

interface Props {
  folder: string;
  onUploaded: (url: string) => void;
  label: string;
  className?: string;
}

/**
 * Bouton générique de sélection + envoi d'image (galerie ou caméra sur
 * mobile grâce à `capture`). Réutilisé partout où un champ "photo" ou
 * "logo" existe : avatar utilisateur, logo fabricant, photo chauffeur,
 * photos produit.
 */
export function ImageUploadButton({ folder, onUploaded, label, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
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
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={
          className ??
          'rounded border border-line px-3 py-2 text-sm text-ink hover:bg-line/30 disabled:opacity-50'
        }
      >
        {uploading ? '…' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
