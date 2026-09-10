// Single lifecycle status for a listing — one name used everywhere
// (database, API, admin UI, public site). No separate "moderation status"
// vs "commercial status": reservation/sale only ever apply to an already
// published listing, so one linear-ish enum models reality correctly.
export type MachineStatus = "draft" | "pending" | "published" | "rejected" | "reserved" | "sold";
export type MachineDrive = "hydraulique" | "servo" | "hybride";
export type MachineCategory = "injection";

export interface MachineSpecs {
  clampingForce?: string;
  screwDiameter?: string;
  injectionVolume?: string;
  injectionPressure?: string;
  motor?: string;
  control?: string;
  plc?: string;
  hmi?: string;
  pumpType?: string;
  condition?: string;
  hours?: string;
}

export interface Machine {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  tonnage: number;
  drive: MachineDrive;
  category: MachineCategory;
  status: MachineStatus;
  featured: boolean;
  wilaya: string;
  price: number | null;
  priceOnRequest: boolean;
  videoUrl?: string | null;
  videoThumbnail?: string | null;
  videoTitle?: string | null;
  /** Uploaded photo URLs, in display order. photos[0] is the main photo
   *  (used on cards, homepage, detail page hero, OG image). */
  photos?: string[];
  specs: MachineSpecs;
  description: string;
  worksPerformed: string[];
  defects: string[];
  accessories: string[];
  isDemo: boolean;
  /** Mise en avant commerciale (badge "Promo" sur le site) — bascule admin,
   *  n'affecte pas le prix affiché. */
  isPromo?: boolean;
  /** Reference to the private SellerProfile record (lib/sellers.ts) — never
   *  the seller's contact details themselves. Admin-only, stripped from every
   *  public data path (see lib/data.ts `toPublicMachine`). */
  sellerId?: string | null;
  adminNote?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}

// Pièces industrielles : catalogue admin-only, séparé des machines (pas de
// workflow de soumission vendeur ni de modération — Jimi ajoute directement
// les références depuis l'admin, comme pour "Ajouter une machine").
// "moules" reste dans cette liste (mêmes stockage/CRUD que les autres
// catégories) mais a son propre lien de menu top-level ("Moules"), séparé
// du sous-menu "Pièces" — voir components/layout/Navbar.tsx.
export type PartCategory =
  | "electrique"
  | "electronique"
  | "hydraulique"
  | "mecanique"
  | "automatisme"
  | "plc-hmi"
  | "variateurs"
  | "servo-moteurs"
  | "moules";
export type PartCondition = "neuf" | "occasion" | "renove";
export type PartStatus = "draft" | "published";

export interface Part {
  id: string;
  slug: string;
  category: PartCategory;
  name: string;
  reference: string;
  description: string;
  condition: PartCondition;
  price: number | null;
  priceOnRequest: boolean;
  photos: string[];
  status: PartStatus;
  isDemo: boolean;
  /** Mise en avant commerciale (badge "Promo" sur le site) — bascule admin,
   *  n'affecte pas le prix affiché. */
  isPromo?: boolean;
}

export type ProjectStatus = "draft" | "published";

export interface Project {
  id: string;
  slug: string;
  title: string;
  brand: string;
  tonnage: number;
  problem: string;
  solution: string;
  result: string;
  status: ProjectStatus;
  videoUrl?: string | null;
  videoThumbnail?: string | null;
  videoTitle?: string | null;
  /** Uploaded photo URLs, in display order. photos[0] is the main photo
   *  (used on the project card and detail page hero). */
  photos?: string[];
  isDemo: boolean;
}

// Client testimonials : soumission publique (toujours "pending", jamais
// publiée directement) OU ajout direct par l'admin (publié immédiatement) —
// même logique de modération que les annonces de machines.
export type TestimonialStatus = "pending" | "published" | "rejected";

export interface Testimonial {
  id: string;
  name: string;
  company?: string | null;
  message: string;
  rating: number;
  status: TestimonialStatus;
  submittedAt: string;
  isDemo: boolean;
}

// Assistant IA commercial (WhatsApp + testeur admin) : une Conversation par
// client (identifié par son numéro WhatsApp, ou "test" pour le simulateur
// admin), avec ses messages, son statut de prise en charge, sa catégorie de
// besoin, les informations extraites et son score commercial.
export type ConversationChannel = "whatsapp" | "test";

// AI_ACTIVE : l'IA répond automatiquement.
// HUMAN_REQUIRED : l'IA a détecté qu'un humain doit reprendre la main mais
//   personne ne l'a encore fait (ex. client hostile, cas hors périmètre).
// HUMAN_ACTIVE : un admin a pris la main, l'IA ne répond plus.
// CLOSED : conversation terminée.
export type ConversationStatus = "AI_ACTIVE" | "HUMAN_REQUIRED" | "HUMAN_ACTIVE" | "CLOSED";

export type MessageRole = "user" | "assistant" | "system";

export const DETECTED_LANGUAGES = ["darija", "fr", "ar", "en"] as const;
export type DetectedLanguage = (typeof DETECTED_LANGUAGES)[number];

// Exportée en const tuple (plutôt qu'un simple union type) pour pouvoir être
// réutilisée telle quelle comme schéma Zod (z.enum) par l'agent IA — une
// seule liste, jamais de risque de désynchronisation entre le type et le
// schéma envoyé au modèle.
export const LEAD_CATEGORIES = [
  "buy_machine",
  "sell_machine",
  "part_electronic",
  "part_electrical",
  "part_hydraulic",
  "part_mechanical",
  "mold",
  "maintenance",
  "repair",
  "renovation",
  "automation",
  "commissioning",
  "quote_request",
  "installation",
  "after_sales",
  "other",
] as const;
export type LeadCategory = (typeof LEAD_CATEGORIES)[number];

export const LEAD_SCORE_LEVELS = ["HOT", "WARM", "COLD"] as const;
export type LeadScoreLevel = (typeof LEAD_SCORE_LEVELS)[number];

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  mediaUrls?: string[];
  createdAt: string;
}

/** Informations de qualification commerciale extraites de la conversation.
 *  Tous les champs sont optionnels : l'IA ne doit renseigner que ce que le
 *  client a réellement dit, jamais inventer une valeur. */
export interface QualificationData {
  machineType?: string | null;
  productToManufacture?: string | null;
  desiredCapacity?: string | null;
  budget?: string | null;
  condition?: "neuf" | "occasion" | "non precise" | null;
  partReference?: string | null;
  partBrand?: string | null;
  machineModel?: string | null;
  quantity?: string | null;
  issueDescription?: string | null;
  location?: string | null;
  timeline?: string | null;
  phone?: string | null;
  urgent?: boolean | null;
  photosReceived?: boolean | null;
  quoteRequested?: boolean | null;
}

export interface Conversation {
  id: string;
  channel: ConversationChannel;
  customerPhone: string | null;
  customerName: string | null;
  status: ConversationStatus;
  language: DetectedLanguage | null;
  category: LeadCategory | null;
  score: LeadScoreLevel;
  scoreReasons: string[];
  qualification: QualificationData;
  summary: string | null;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string[];
  readTimeMinutes: number;
  publishedAt: string;
  category: string;
  /** Maillage interne vers les catégories, machines, services ou pages
   *  Acheter/Vendre pertinentes pour cet article. */
  relatedLinks?: { href: string; label: string }[];
}
