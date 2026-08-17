import { defineRouting } from "next-intl/routing";

export const locales = ["fr", "ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "fr",
  localePrefix: "as-needed",
  // Le français est explicitement la langue par défaut du site : on désactive
  // la détection automatique via Accept-Language pour que tout nouveau visiteur
  // arrive en français, quel que soit son navigateur. Le sélecteur de langue
  // reste le seul moyen de changer de langue.
  localeDetection: false,
  localeCookie: {
    name: "JIMI_LOCALE",
  },
});
