export type MachineStatus = "disponible" | "vendue" | "reservee" | "nouveau";
export type MachineDrive = "hydraulique" | "servo" | "hybride";
export type MachineCategory = "injection";
export type ModerationStatus = "pending" | "published" | "rejected" | "draft";

export interface MachineSeller {
  name: string;
  phone: string;
  email?: string | null;
}

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
  images: number;
  videoUrl?: string | null;
  videoThumbnail?: string | null;
  videoTitle?: string | null;
  photos?: string[];
  specs: MachineSpecs;
  description: string;
  worksPerformed: string[];
  defects: string[];
  accessories: string[];
  isDemo: boolean;
  /** Publication workflow state — distinct from the commercial `status` above.
   *  Missing on legacy/demo records, which are treated as "published". */
  moderationStatus?: ModerationStatus;
  seller?: MachineSeller | null;
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
