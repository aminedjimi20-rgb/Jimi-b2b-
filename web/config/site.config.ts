/**
 * CONFIGURATION CENTRALE DU SITE — JIMI RENOVATION & INSTALLATION
 * -----------------------------------------------------------------
 * Toutes les informations "réelles" (téléphone, WhatsApp, email, adresse,
 * réseaux sociaux) sont centralisées ICI et nulle part ailleurs dans le
 * code. Pour les changer, modifiez uniquement les valeurs ci-dessous (ou
 * les variables d'environnement correspondantes dans .env.local) — tout
 * le site se met à jour automatiquement.
 */

export const siteConfig = {
  companyName: "JIMI Industrie",
  companyShortName: "JIMI",
  tagline: {
    fr: "Machines • Pièces • Moules • Automatisation",
    ar: "آلات • قطع غيار • قوالب • أتمتة",
    en: "Machines • Parts • Molds • Automation",
  },

  // --- Coordonnées ---
  contact: {
    // Numéro principal, utilisé pour tous les boutons WhatsApp et le lien "tel:" du site.
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "213654486224", // format international sans "+" ni espaces
    phoneDisplay: process.env.NEXT_PUBLIC_PHONE_DISPLAY || "+213 654 486 224",
    phoneHref: process.env.NEXT_PUBLIC_PHONE_HREF || "+213654486224",
    // Second numéro joignable (WhatsApp et téléphone) — affiché en complément sur la page Contact et le footer.
    whatsappNumberSecondary: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER_2 || "213777168962",
    phoneDisplaySecondary: process.env.NEXT_PUBLIC_PHONE_DISPLAY_2 || "+213 777 168 962",
    phoneHrefSecondary: process.env.NEXT_PUBLIC_PHONE_HREF_2 || "+213777168962",
    email: process.env.NEXT_PUBLIC_EMAIL || "aminedjimi20@gmail.com",
    addressLine: {
      fr: "Algérie — Déplacement possible dans toutes les wilayas",
      ar: "الجزائر — التنقل ممكن إلى جميع الولايات",
      en: "Algeria — On-site service available nationwide",
    },
    baseCity: "Alger",
    mapsUrl: "", // laisser vide si non disponible
  },

  social: {
    facebook: "", // ex: https://facebook.com/jimirenovation
    instagram: "",
    linkedin: "",
    youtube: "",
  },

  // Utilisé pour le JSON-LD et les métadonnées SEO
  // (l'image Open Graph est générée dynamiquement, voir app/[locale]/opengraph-image.tsx)
  seo: {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://jimi-renovation.example.dz",
    twitterHandle: "",
  },

  legal: {
    rc: "[REGISTRE_DE_COMMERCE]",
    nif: "[NIF]",
    founderRole: {
      fr: "Automaticien / Ingénieur en automatisation industrielle",
      ar: "مهندس أتمتة صناعية",
      en: "Automation Engineer / Industrial Automatician",
    },
  },

  admin: {
    // Mot de passe par défaut du tableau de bord — À CHANGER via la variable
    // d'environnement ADMIN_PASSWORD avant mise en production.
    defaultPasswordHint: "Définissez ADMIN_PASSWORD dans .env.local",
  },
} as const;

export type SiteConfig = typeof siteConfig;

/** Construit un lien wa.me avec un message pré-rempli et encodé. */
export function buildWhatsAppLink(message: string, number: string = siteConfig.contact.whatsappNumber) {
  const cleanNumber = number.replace(/[^\d]/g, "");
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}
