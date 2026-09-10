import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /admin, /api : pages internes. Les paramètres de filtre/tri
        // ci-dessous n'existent pas encore côté UI, mais sont bloqués par
        // précaution : le canonical de chaque page filtrable pointera de
        // toute façon vers l'URL propre, donc ceci évite uniquement que
        // Googlebot explore/indexe des variantes ?brand=...&sort=... si un
        // filtre est ajouté plus tard sans y penser.
        disallow: [
          "/admin",
          "/api",
          "/*?*brand=",
          "/*?*price=",
          "/*?*wilaya=",
          "/*?*sort=",
        ],
      },
    ],
    sitemap: `${siteConfig.seo.siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
