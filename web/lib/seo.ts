import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/site.config";

/**
 * Construit `alternates` (canonical + hreflang) pour un chemin donné,
 * identique quelle que soit la locale (ex: "/machines", `/machines/${slug}`,
 * "" pour l'accueil).
 *
 * IMPORTANT : Next.js REMPLACE entièrement `alternates` à chaque segment
 * (layout → page) au lieu de le fusionner — un `generateMetadata` de page
 * qui ne définit que `canonical` efface silencieusement le `languages`
 * (hreflang) défini par le layout parent. Toute page avec son propre
 * `alternates.canonical` DOIT donc passer par cette fonction pour ne pas
 * perdre son hreflang.
 */
export function buildAlternates(path: string, locale: string) {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = l === routing.defaultLocale ? path || "/" : `/${l}${path}`;
  }
  languages["x-default"] = path || "/";

  return {
    canonical: locale === routing.defaultLocale ? path || "/" : `/${locale}${path}`,
    languages,
  };
}

/** Absolute URL for a given path + locale — used by JSON-LD (Breadcrumb,
 *  Product, Service...) which requires fully-qualified URLs, unlike
 *  `alternates.canonical` which Next.js resolves against `metadataBase`. */
export function absoluteUrl(path: string, locale: string): string {
  const base = siteConfig.seo.siteUrl.replace(/\/$/, "");
  if (locale === routing.defaultLocale) return `${base}${path || "/"}`;
  return `${base}/${locale}${path}`;
}
