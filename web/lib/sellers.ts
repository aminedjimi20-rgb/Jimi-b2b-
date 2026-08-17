import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export interface SellerProfile {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  wilaya?: string | null;
  company?: string | null;
  createdAt: string;
}

export type SellerInput = Omit<SellerProfile, "id" | "createdAt">;

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

function fromRow(row: Record<string, unknown>): SellerProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    whatsapp: (row.whatsapp as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    wilaya: (row.wilaya as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---- Supabase-backed implementation (production) --------------------------

async function dbGetSellers(): Promise<SellerProfile[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("sellers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

async function dbFindOrCreateSeller(input: SellerInput): Promise<SellerProfile> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("sellers").select("*");
  const match = (existing ?? []).find((s) => normalizePhone(s.phone) === normalizePhone(input.phone));
  if (match) return fromRow(match);

  const { data, error } = await supabase
    .from("sellers")
    .insert({
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      wilaya: input.wilaya,
      company: input.company,
    })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

// ---- Ephemeral file-based fallback (local dev only — NOT the production
// fix; data does not survive across Vercel serverless instances) -----------

const DATA_DIR = path.join(os.tmpdir(), "jimi-sellers-store");
const FILE = path.join(DATA_DIR, "sellers.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetSellers(): Promise<SellerProfile[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as SellerProfile[];
  } catch {
    return [];
  }
}

async function fileFindOrCreateSeller(input: SellerInput): Promise<SellerProfile> {
  const sellers = await fileGetSellers();
  const existing = sellers.find((s) => normalizePhone(s.phone) === normalizePhone(input.phone));
  if (existing) return existing;
  const seller: SellerProfile = { id: randomUUID(), createdAt: new Date().toISOString(), ...input };
  sellers.unshift(seller);
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(sellers, null, 2), "utf-8");
  return seller;
}

// ---- Public API -------------------------------------------------------

export async function getSellers(): Promise<SellerProfile[]> {
  return isSupabaseConfigured() ? dbGetSellers() : fileGetSellers();
}

export async function getSellerById(id: string): Promise<SellerProfile | undefined> {
  const sellers = await getSellers();
  return sellers.find((s) => s.id === id);
}

/** Finds an existing seller by phone number, or creates a new profile.
 *  Sellers have no login, so phone number is the de-duplication key. An
 *  existing profile is never silently overwritten by a later submission —
 *  admins edit it explicitly if it needs correcting. */
export async function findOrCreateSeller(input: SellerInput): Promise<SellerProfile> {
  return isSupabaseConfigured() ? dbFindOrCreateSeller(input) : fileFindOrCreateSeller(input);
}

export async function updateSeller(id: string, patch: Partial<SellerInput>): Promise<SellerProfile | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseAdmin().from("sellers").update(patch).eq("id", id).select("*").single();
    if (error) return null;
    return fromRow(data);
  }
  const sellers = await fileGetSellers();
  const index = sellers.findIndex((s) => s.id === id);
  if (index === -1) return null;
  sellers[index] = { ...sellers[index], ...patch };
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(sellers, null, 2), "utf-8");
  return sellers[index];
}
