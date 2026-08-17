/**
 * CONFIGURATION CENTRALE DU SITE — JIMI RENOVATION & INSTALLATION
 * -----------------------------------------------------------------
 * Toutes les informations "réelles" (téléphone, WhatsApp, email, adresse,
 * réseaux sociaux) sont centralisées ICI et nulle part ailleurs dans le
 * code. Remplacez les valeurs marquées [PLACEHOLDER] par les vraies
 * coordonnées avant la mise en ligne définitive — tout le site se
 * mettra à jour automatiquement.
 *
 * Vous pouvez aussi surcharger ces valeurs via des variables
 * d'environnement (fichier .env.local), sans toucher au code.
 */

export const siteConfig = {
  companyName: "Jimi Renovation & Installation",
  companyShortName: "Jimi",
  tagline: {
    fr: "Machines d'injection plastique & solutions d'automatisation industrielle",
    ar: "آلات حقن البلاستيك وحلول الأتمتة الصناعية",
    en: "Plastic injection machines & industrial automation solutions",
  },

  // --- Coordonnées (à remplacer par les vraies informations) ---
  contact: {
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "213555000000", // format international sans "+" ni espaces
    phoneDisplay: process.env.NEXT_PUBLIC_PHONE_DISPLAY || "[PHONE_NUMBER]",
    phoneHref: process.env.NEXT_PUBLIC_PHONE_HREF || "+213555000000",
    email: process.env.NEXT_PUBLIC_EMAIL || "[EMAIL]",
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
