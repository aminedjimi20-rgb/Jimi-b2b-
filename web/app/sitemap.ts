import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site.config";
import { routing } from "@/i18n/routing";
import { getPublicMachines, getArticles, getPublicProjects, getPublicParts } from "@/lib/data";

// Next.js caches route handlers like sitemap.ts by default. Machines,
// pieces, projects and articles are all admin-editable at runtime (Firestore),
// so a cached sitemap would keep missing new listings until the next deploy —
// force it to regenerate on every request instead.
export const dynamic = "force-dynamic";

const staticPaths = [
  "",
  "/catalogue",
  "/machines",
  "/acheter",
  "/acheter-machine",
  "/vendre-machine",
  "/vendre-equipement",
  "/pieces-industrielles",
  "/pieces-industrielles/electrique",
  "/pieces-industrielles/electronique",
  "/pieces-industrielles/hydraulique",
  "/pieces-industrielles/mecanique",
  "/pieces-industrielles/automatisme",
  "/pieces-industrielles/plc-hmi",
  "/pieces-industrielles/variateurs",
  "/pieces-industrielles/servo-moteurs",
  "/pieces-industrielles/moules",
  "/services",
  "/services/renovation-machine-injection",
  "/services/automatisation-industrielle",
  "/services/maintenance-depannage",
  "/realisations",
  "/avis",
  "/blog",
  "/contact",
  "/politique-de-confidentialite",
];

function localizedPath(path: string, locale: string) {
  const base = siteConfig.seo.siteUrl.replace(/\/$/, "");
  if (locale === routing.defaultLocale) {
    return `${base}${path || "/"}`;
  }
  return `${base}/${locale}${path}`;
}

/** hreflang alternates for every locale of a given path, embedded directly
 *  in the sitemap entry — in addition to (not instead of) the per-page
 *  <link rel="alternate" hreflang> tags from lib/seo.ts's buildAlternates. */
function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = localizedPath(path, locale);
  }
  languages["x-default"] = localizedPath(path, routing.defaultLocale);
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const machines = await getPublicMachines();
  const articles = await getArticles();
  const projects = await getPublicProjects();
  const parts = await getPublicParts();

  const dynamicPaths = [
    ...machines.map((m) => `/machines/${m.slug}`),
    ...articles.map((a) => `/blog/${a.slug}`),
    ...projects.map((p) => `/realisations/${p.slug}`),
    ...parts.map((p) => `/pieces-industrielles/${p.category}/${p.slug}`),
  ];

  const allPaths = [...staticPaths, ...dynamicPaths];

  const entries: MetadataRoute.Sitemap = [];
  for (const path of allPaths) {
    const alternates = { languages: languageAlternates(path) };
    for (const locale of routing.locales) {
      entries.push({
        url: localizedPath(path, locale),
        lastModified: new Date(),
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.7,
        alternates,
      });
    }
  }
  return entries;
}
