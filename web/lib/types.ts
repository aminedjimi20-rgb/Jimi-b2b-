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

export interface Project {
  id: string;
  slug: string;
  title: string;
  brand: string;
  tonnage: number;
  problem: string;
  solution: string;
  result: string;
  isDemo: true;
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
