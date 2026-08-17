import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export interface BuyerProfile {
  id: string;
  name: string;
  company?: string | null;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  wilaya?: string | null;
  createdAt: string;
}

export type BuyerInput = Omit<BuyerProfile, "id" | "createdAt">;

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

function fromRow(row: Record<string, unknown>): BuyerProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    company: (row.company as string | null) ?? null,
    phone: row.phone as string,
    whatsapp: (row.whatsapp as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    wilaya: (row.wilaya as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---- Supabase-backed implementation (production) --------------------------

async function dbGetBuyers(): Promise<BuyerProfile[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("buyers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

async function dbFindOrCreateBuyer(input: BuyerInput): Promise<BuyerProfile> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("buyers").select("*");
  const match = (existing ?? []).find((b) => normalizePhone(b.phone) === normalizePhone(input.phone));
  if (match) return fromRow(match);

  const { data, error } = await supabase
    .from("buyers")
    .insert({
      name: input.name,
      company: input.company,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      wilaya: input.wilaya,
    })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

// ---- Ephemeral file-based fallback (local dev only — NOT the production
// fix; data does not survive across Vercel serverless instances) -----------

const DATA_DIR = path.join(os.tmpdir(), "jimi-buyers-store");
const FILE = path.join(DATA_DIR, "buyers.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetBuyers(): Promise<BuyerProfile[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as BuyerProfile[];
  } catch {
    return [];
  }
}

async function fileFindOrCreateBuyer(input: BuyerInput): Promise<BuyerProfile> {
  const buyers = await fileGetBuyers();
  const existing = buyers.find((b) => normalizePhone(b.phone) === normalizePhone(input.phone));
  if (existing) return existing;
  const buyer: BuyerProfile = { id: randomUUID(), createdAt: new Date().toISOString(), ...input };
  buyers.unshift(buyer);
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(buyers, null, 2), "utf-8");
  return buyer;
}

// ---- Public API -------------------------------------------------------

export async function getBuyers(): Promise<BuyerProfile[]> {
  return isSupabaseConfigured() ? dbGetBuyers() : fileGetBuyers();
}

export async function getBuyerById(id: string): Promise<BuyerProfile | undefined> {
  const buyers = await getBuyers();
  return buyers.find((b) => b.id === id);
}

/** Finds an existing buyer by phone number, or creates a new profile — same
 *  de-duplication approach as findOrCreateSeller (no buyer login exists). */
export async function findOrCreateBuyer(input: BuyerInput): Promise<BuyerProfile> {
  return isSupabaseConfigured() ? dbFindOrCreateBuyer(input) : fileFindOrCreateBuyer(input);
}
