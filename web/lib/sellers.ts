import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

// Same ephemeral-tmpdir pattern as lib/leads.ts / lib/machinesStore.ts — see
// web/README.md for the production database migration path. Seller contact
// details are private by design: this store is only ever read from
// admin-authenticated API routes.
const DATA_DIR = path.join(os.tmpdir(), "jimi-sellers-store");
const FILE = path.join(DATA_DIR, "sellers.json");

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

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

export async function getSellers(): Promise<SellerProfile[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as SellerProfile[];
  } catch {
    return [];
  }
}

async function saveSellers(sellers: SellerProfile[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(sellers, null, 2), "utf-8");
}

export async function getSellerById(id: string): Promise<SellerProfile | undefined> {
  const sellers = await getSellers();
  return sellers.find((s) => s.id === id);
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/** Finds an existing seller by phone number, or creates a new profile.
 *  Sellers have no login, so phone number is the de-duplication key. An
 *  existing profile is never silently overwritten by a later submission —
 *  admins edit it explicitly if it needs correcting. */
export async function findOrCreateSeller(input: SellerInput): Promise<SellerProfile> {
  const sellers = await getSellers();
  const existing = sellers.find((s) => normalizePhone(s.phone) === normalizePhone(input.phone));
  if (existing) return existing;

  const seller: SellerProfile = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  sellers.unshift(seller);
  await saveSellers(sellers);
  return seller;
}

export async function updateSeller(id: string, patch: Partial<SellerInput>): Promise<SellerProfile | null> {
  const sellers = await getSellers();
  const index = sellers.findIndex((s) => s.id === id);
  if (index === -1) return null;
  sellers[index] = { ...sellers[index], ...patch };
  await saveSellers(sellers);
  return sellers[index];
}
