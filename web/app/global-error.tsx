"use client";

import Link from "next/link";

/** Filet de sécurité ultime : ne se déclenche que si le root layout
 *  lui-même plante (très rare — app/[locale]/error.tsx gère déjà tout le
 *  reste). Doit définir son propre <html>/<body> et ne peut pas dépendre
 *  de next-intl : pas de locale résolue à ce niveau, donc contenu en
 *  français par défaut (cohérent avec la politique du site, voir
 *  i18n/routing.ts). */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0a0f14" }}>
              Une erreur est survenue
            </h1>
            <p style={{ marginTop: 12, color: "#566270" }}>
              Quelque chose s&apos;est mal passé. Vous pouvez réessayer ou revenir à l&apos;accueil.
            </p>
            <div
              style={{
                marginTop: 28,
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => retry()}
                style={{
                  background: "#0e6bd6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Réessayer
              </button>
              <Link
                href="/"
                style={{
                  border: "1px solid #e2e6ea",
                  borderRadius: 8,
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#0a0f14",
                  textDecoration: "none",
                }}
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
