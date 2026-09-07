import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site.config";
import { routing } from "@/i18n/routing";
import { getPublicMachines, getArticles } from "@/lib/data";

const staticPaths = [
  "",
  "/machines",
  "/acheter-machine",
  "/vendre-machine",
  "/pieces-industrielles",
  "/pieces-industrielles/electronique",
  "/pieces-industrielles/moules",
  "/pieces-industrielles/hydraulique",
  "/pieces-industrielles/mecanique",
  "/services",
  "/services/renovation-machine-injection",
  "/services/automatisation-industrielle",
  "/services/maintenance-depannage",
  "/realisations",
  "/blog",
  "/contact",
];

function localizedPath(path: string, locale: string) {
  const base = siteConfig.seo.siteUrl.replace(/\/$/, "");
  if (locale === routing.defaultLocale) {
    return `${base}${path || "/"}`;
  }
  return `${base}/${locale}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const machines = await getPublicMachines();
  const articles = getArticles();

  const dynamicPaths = [
    ...machines.map((m) => `/machines/${m.slug}`),
    ...articles.map((a) => `/blog/${a.slug}`),
  ];

  const allPaths = [...staticPaths, ...dynamicPaths];

  const entries: MetadataRoute.Sitemap = [];
  for (const path of allPaths) {
    for (const locale of routing.locales) {
      entries.push({
        url: localizedPath(path, locale),
        lastModified: new Date(),
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.7,
      });
    }
  }
  return entries;
}
