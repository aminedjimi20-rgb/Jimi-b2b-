'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  /** Option affichée en tête pour revenir à "aucun choix" — omise si non fournie. */
  emptyLabel?: string;
  noResultsLabel?: string;
  className?: string;
}

/**
 * Sélecteur avec recherche — remplace un <select> classique quand la liste
 * peut devenir longue (clients, fabricants...) et qu'il devient pénible de
 * la parcourir en scrollant.
 */
export function SearchableSelect({ value, onChange, options, placeholder, emptyLabel, noResultsLabel, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded border border-line bg-paper px-3 py-2 text-start text-sm text-ink"
      >
        {selected ? selected.label : <span className="text-muted">{placeholder}</span>}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded border border-line bg-panel shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="sticky top-0 w-full border-b border-line bg-panel px-3 py-2 text-sm text-ink outline-none"
          />
          {emptyLabel && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
                setQuery('');
              }}
              className="block w-full px-3 py-2 text-start text-sm text-muted hover:bg-line/20"
            >
              {emptyLabel}
            </button>
          )}
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted">{noResultsLabel ?? '—'}</p>}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
                setQuery('');
              }}
              className={`block w-full px-3 py-2 text-start text-sm hover:bg-line/20 ${o.value === value ? 'bg-accent/10 text-accent' : 'text-ink'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
