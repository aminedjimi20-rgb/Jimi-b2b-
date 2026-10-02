'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerModalProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

// Lecture de code-barres/QR via la caméra du navigateur — aucune app native
// requise, marche sur Desktop/Android/iPhone (Safari/Chrome récents).
function BarcodeScannerModal({ onScan, onClose }: BarcodeScannerModalProps) {
  const t = useTranslations('common');
  const rawId = useId();
  const elementId = `barcode-scanner-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    import('html5-qrcode').then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            if (handledRef.current) return;
            handledRef.current = true;
            onScan(decodedText);
          },
          () => {
            // échec de décodage sur une frame — normal tant qu'aucun code n'est cadré.
          },
        )
        .catch(() => setError(t('cameraError')));
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-panel p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t('scanBarcode')}</h2>
          <button onClick={onClose} className="text-sm text-muted hover:text-ink" aria-label={t('close')}>
            ✕
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-xs text-red-600">{error}</p>
        ) : (
          <p className="mt-1 text-xs text-muted">{t('scanBarcodeHint')}</p>
        )}
        <div id={elementId} className="mt-3 overflow-hidden rounded" />
      </div>
    </div>
  );
}

export function BarcodeScanButton({ onScan, className, label }: { onScan: (code: string) => void; className?: string; label?: string }) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'rounded border border-line px-3 py-2 text-sm text-ink hover:bg-line/30'}
      >
        📷 {label ?? t('scanBarcode')}
      </button>
      {open && (
        <BarcodeScannerModal
          onScan={(code) => {
            setOpen(false);
            onScan(code);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
