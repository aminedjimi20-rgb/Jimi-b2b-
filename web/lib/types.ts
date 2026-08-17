export type MachineStatus = "disponible" | "vendue" | "reservee" | "nouveau";
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
  images: number;
  videoUrl?: string | null;
  specs: MachineSpecs;
  description: string;
  worksPerformed: string[];
  defects: string[];
  accessories: string[];
  isDemo: boolean;
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
