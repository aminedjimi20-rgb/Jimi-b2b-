import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Machine } from "@/lib/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export type AdminMachineInput = {
  brand: string;
  model: string;
  year: number;
  tonnage: number;
  drive: Machine["drive"];
  status: Machine["status"];
  wilaya: string;
  price: number | null;
  priceOnRequest: boolean;
  description: string;
  videoUrl?: string | null;
  videoThumbnail?: string | null;
  videoTitle?: string | null;
  photos?: string[];
  sellerId?: string | null;
  adminNote?: string | null;
  reviewedAt?: string | null;
};

export type SellerListingInput = {
  brand: string;
  model: string;
  tonnage: number;
  year: number | null;
  drive: Machine["drive"];
  wilaya: string;
  price: number | null;
  priceOnRequest: boolean;
  description: string;
  videoUrl?: string | null;
  photos?: string[];
  sellerId: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fromRow(row: Record<string, unknown>): Machine {
  return {
    id: row.id as string,
    slug: row.slug as string,
    brand: row.brand as string,
    model: row.model as string,
    year: row.year as number,
    tonnage: Number(row.tonnage),
    drive: row.drive as Machine["drive"],
    category: row.category as Machine["category"],
    status: row.status as Machine["status"],
    featured: Boolean(row.featured),
    wilaya: (row.wilaya as string) ?? "",
    price: row.price === null ? null : Number(row.price),
    priceOnRequest: Boolean(row.price_on_request),
    videoUrl: (row.video_url as string | null) ?? null,
    videoThumbnail: (row.video_thumbnail as string | null) ?? null,
    videoTitle: (row.video_title as string | null) ?? null,
    photos: (row.photos as string[] | null) ?? [],
    specs: (row.specs as Machine["specs"]) ?? {},
    description: (row.description as string) ?? "",
    worksPerformed: (row.works_performed as string[] | null) ?? [],
    defects: (row.defects as string[] | null) ?? [],
    accessories: (row.accessories as string[] | null) ?? [],
    isDemo: false,
    sellerId: (row.seller_id as string | null) ?? null,
    adminNote: (row.admin_note as string | null) ?? null,
    submittedAt: (row.submitted_at as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
  };
}

async function uniqueSlug(base: string, existingSlugs: string[]): Promise<string> {
  let slug = base;
  let counter = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

// ---- Supabase-backed implementation (production) --------------------------

async function dbGetRuntimeMachines(): Promise<Machine[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("machines")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

async function dbAddRuntimeMachine(input: AdminMachineInput): Promise<Machine> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("machines").select("slug");
  const baseSlug = slugify(`${input.brand}-${input.model}-${input.tonnage}t-${input.year}`);
  const slug = await uniqueSlug(baseSlug, (existing ?? []).map((r) => r.slug as string));

  const { data, error } = await supabase
    .from("machines")
    .insert({
      slug,
      brand: input.brand,
      model: input.model,
      year: input.year,
      tonnage: input.tonnage,
      drive: input.drive,
      category: "injection",
      status: input.status,
      featured: false,
      wilaya: input.wilaya,
      price: input.price,
      price_on_request: input.priceOnRequest,
      video_url: input.videoUrl || null,
      video_thumbnail: input.videoThumbnail || null,
      video_title: input.videoTitle || null,
      photos: input.photos ?? [],
      specs: {},
      description: input.description,
      works_performed: [],
      defects: [],
      accessories: [],
      seller_id: null,
      admin_note: null,
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

async function dbSubmitMachineForReview(input: SellerListingInput): Promise<Machine> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("machines").select("slug");
  const baseSlug = slugify(`${input.brand}-${input.model}-${input.tonnage}t-${input.year ?? "na"}`);
  const slug = await uniqueSlug(baseSlug, (existing ?? []).map((r) => r.slug as string));

  const { data, error } = await supabase
    .from("machines")
    .insert({
      slug,
      brand: input.brand,
      model: input.model,
      year: input.year ?? new Date().getFullYear(),
      tonnage: input.tonnage,
      drive: input.drive,
      category: "injection",
      status: "pending",
      featured: false,
      wilaya: input.wilaya,
      price: input.price,
      price_on_request: input.priceOnRequest,
      video_url: input.videoUrl || null,
      photos: input.photos ?? [],
      specs: {},
      description: input.description,
      works_performed: [],
      defects: [],
      accessories: [],
      seller_id: input.sellerId,
      submitted_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

function toUpdateRow(patch: Partial<AdminMachineInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ("brand" in patch) row.brand = patch.brand;
  if ("model" in patch) row.model = patch.model;
  if ("year" in patch) row.year = patch.year;
  if ("tonnage" in patch) row.tonnage = patch.tonnage;
  if ("drive" in patch) row.drive = patch.drive;
  if ("status" in patch) row.status = patch.status;
  if ("wilaya" in patch) row.wilaya = patch.wilaya;
  if ("price" in patch) row.price = patch.price;
  if ("priceOnRequest" in patch) row.price_on_request = patch.priceOnRequest;
  if ("description" in patch) row.description = patch.description;
  if ("videoUrl" in patch) row.video_url = patch.videoUrl;
  if ("videoThumbnail" in patch) row.video_thumbnail = patch.videoThumbnail;
  if ("videoTitle" in patch) row.video_title = patch.videoTitle;
  if ("photos" in patch) row.photos = patch.photos;
  if ("sellerId" in patch) row.seller_id = patch.sellerId;
  if ("adminNote" in patch) row.admin_note = patch.adminNote;
  if ("reviewedAt" in patch) row.reviewed_at = patch.reviewedAt;
  row.updated_at = new Date().toISOString();
  return row;
}

async function dbUpdateRuntimeMachine(id: string, patch: Partial<AdminMachineInput>): Promise<Machine | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("machines")
    .update(toUpdateRow(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) return null;
  return fromRow(data);
}

async function dbDeleteRuntimeMachine(id: string): Promise<void> {
  await getSupabaseAdmin().from("machines").delete().eq("id", id);
}

// ---- Ephemeral file-based fallback (local dev only — NOT the production
// fix; on Vercel each serverless invocation can run in a different
// container, so os.tmpdir() writes are NOT guaranteed visible to the next
// request. This is exactly why machines vanished after Approve: without
// Supabase configured, "persistence" here only holds within one warm
// instance. Configure SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in
// production — see web/supabase/schema.sql.) -----------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-machines-store");
const FILE = path.join(DATA_DIR, "machines.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetRuntimeMachines(): Promise<Machine[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as Machine[];
  } catch {
    return [];
  }
}

async function fileSaveRuntimeMachines(machines: Machine[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(machines, null, 2), "utf-8");
}

async function fileAddRuntimeMachine(input: AdminMachineInput): Promise<Machine> {
  const machines = await fileGetRuntimeMachines();
  const baseSlug = slugify(`${input.brand}-${input.model}-${input.tonnage}t-${input.year}`);
  const slug = await uniqueSlug(baseSlug, machines.map((m) => m.slug));

  const machine: Machine = {
    id: randomUUID(),
    slug,
    brand: input.brand,
    model: input.model,
    year: input.year,
    tonnage: input.tonnage,
    drive: input.drive,
    category: "injection",
    status: input.status,
    featured: false,
    wilaya: input.wilaya,
    price: input.price,
    priceOnRequest: input.priceOnRequest,
    videoUrl: input.videoUrl || null,
    videoThumbnail: input.videoThumbnail || null,
    videoTitle: input.videoTitle || null,
    photos: input.photos ?? [],
    specs: {},
    description: input.description,
    worksPerformed: [],
    defects: [],
    accessories: [],
    isDemo: false,
    sellerId: null,
    adminNote: null,
    submittedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
  };

  machines.unshift(machine);
  await fileSaveRuntimeMachines(machines);
  return machine;
}

async function fileSubmitMachineForReview(input: SellerListingInput): Promise<Machine> {
  const machines = await fileGetRuntimeMachines();
  const baseSlug = slugify(`${input.brand}-${input.model}-${input.tonnage}t-${input.year ?? "na"}`);
  const slug = await uniqueSlug(baseSlug, machines.map((m) => m.slug));

  const machine: Machine = {
    id: randomUUID(),
    slug,
    brand: input.brand,
    model: input.model,
    year: input.year ?? new Date().getFullYear(),
    tonnage: input.tonnage,
    drive: input.drive,
    category: "injection",
    status: "pending",
    featured: false,
    wilaya: input.wilaya,
    price: input.price,
    priceOnRequest: input.priceOnRequest,
    videoUrl: input.videoUrl || null,
    videoThumbnail: null,
    videoTitle: null,
    photos: input.photos ?? [],
    specs: {},
    description: input.description,
    worksPerformed: [],
    defects: [],
    accessories: [],
    isDemo: false,
    sellerId: input.sellerId,
    adminNote: null,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
  };

  machines.unshift(machine);
  await fileSaveRuntimeMachines(machines);
  return machine;
}

async function fileUpdateRuntimeMachine(id: string, patch: Partial<AdminMachineInput>): Promise<Machine | null> {
  const machines = await fileGetRuntimeMachines();
  const index = machines.findIndex((m) => m.id === id);
  if (index === -1) return null;
  machines[index] = { ...machines[index], ...patch };
  await fileSaveRuntimeMachines(machines);
  return machines[index];
}

async function fileDeleteRuntimeMachine(id: string): Promise<void> {
  const machines = await fileGetRuntimeMachines();
  await fileSaveRuntimeMachines(machines.filter((m) => m.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getRuntimeMachines(): Promise<Machine[]> {
  return isSupabaseConfigured() ? dbGetRuntimeMachines() : fileGetRuntimeMachines();
}

export async function addRuntimeMachine(input: AdminMachineInput): Promise<Machine> {
  return isSupabaseConfigured() ? dbAddRuntimeMachine(input) : fileAddRuntimeMachine(input);
}

/** Public "sell my machine" submission — always lands as PENDING, invisible on the site
 *  until an admin approves it via `updateRuntimeMachine`. */
export async function submitMachineForReview(input: SellerListingInput): Promise<Machine> {
  return isSupabaseConfigured() ? dbSubmitMachineForReview(input) : fileSubmitMachineForReview(input);
}

export async function updateRuntimeMachine(
  id: string,
  patch: Partial<AdminMachineInput>
): Promise<Machine | null> {
  return isSupabaseConfigured() ? dbUpdateRuntimeMachine(id, patch) : fileUpdateRuntimeMachine(id, patch);
}

export async function deleteRuntimeMachine(id: string): Promise<void> {
  return isSupabaseConfigured() ? dbDeleteRuntimeMachine(id) : fileDeleteRuntimeMachine(id);
}
