'use client';

import { useEffect, useState } from 'react';

interface LightboxImage {
  url: string;
}

export function ImageLightbox({
  images,
  startIndex = 0,
  title,
  onClose,
}: {
  images: LightboxImage[];
  startIndex?: number;
  title?: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);

  if (images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white hover:bg-white/20"
        aria-label="Fermer"
      >
        ✕
      </button>
      {title && <p className="absolute top-5 start-5 max-w-[60%] truncate text-sm text-white/70">{title}</p>}
      {images.length > 1 && (
        <p className="absolute top-16 start-5 text-xs text-white/50 sm:top-5 sm:start-auto sm:end-16">
          {index + 1} / {images.length}
        </p>
      )}

      <div className="relative flex w-full max-w-3xl flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {images.length > 1 && (
          <button
            onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
            className="absolute start-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            aria-label="Précédent"
          >
            ‹
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index].url} alt="" className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl" />
        {images.length > 1 && (
          <button
            onClick={() => setIndex((i) => (i + 1) % images.length)}
            className="absolute end-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
            aria-label="Suivant"
          >
            ›
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex max-w-full gap-2 overflow-x-auto px-2 pb-1" onClick={(e) => e.stopPropagation()}>
          {images.map((img, i) => (
            <button
              key={img.url + i}
              onClick={() => setIndex(i)}
              className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded border-2 transition ${
                i === index ? 'border-accent' : 'border-transparent opacity-50 hover:opacity-90'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
