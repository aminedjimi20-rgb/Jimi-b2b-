import type { Metadata } from "next";
import Link from "next/link";
import { Factory, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "La page que vous recherchez n'existe pas ou a été déplacée.",
  robots: { index: false, follow: true },
};

/** Catch-all pour toute URL qui ne correspond à aucune route de l'application
 *  (contrairement à app/[locale]/not-found.tsx, qui ne gère que les
 *  `notFound()` levés à l'intérieur d'une route déjà résolue sous [locale]).
 *  Sans locale résolue ici, on affiche la version française — cohérent avec
 *  la politique du site (voir i18n/routing.ts, localeDetection: false) qui
 *  fait toujours du français la langue par défaut d'un nouveau visiteur. */
export default function RootNotFound() {
  return (
    <section className="flex min-h-[60vh] items-center py-20">
      <div className="container-jimi">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-ink)] text-white">
            <Factory size={26} />
          </span>
          <p className="mt-6 text-6xl font-extrabold tracking-tight text-[var(--color-border)]">
            404
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--color-ink)]">Page introuvable</h1>
          <p className="mt-3 text-[var(--color-text-muted)]">
            La page que vous recherchez n&apos;existe pas ou a été déplacée.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#0b58ad] md:text-base"
          >
            <ArrowLeft size={16} />
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </section>
  );
}
