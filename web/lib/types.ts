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
export type PartCategory = "electronique" | "moules" | "hydraulique" | "mecanique";
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

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string[];
  readTimeMinutes: number;
  publishedAt: string;
  category: string;
}
