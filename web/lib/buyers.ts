import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

// Same ephemeral-tmpdir pattern as lib/sellers.ts. Buyer contact details are
// private by design: only ever read from admin-authenticated API routes.
const DATA_DIR = path.join(os.tmpdir(), "jimi-buyers-store");
const FILE = path.join(DATA_DIR, "buyers.json");

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

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

export async function getBuyers(): Promise<BuyerProfile[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as BuyerProfile[];
  } catch {
    return [];
  }
}

async function saveBuyers(buyers: BuyerProfile[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(buyers, null, 2), "utf-8");
}

export async function getBuyerById(id: string): Promise<BuyerProfile | undefined> {
  const buyers = await getBuyers();
  return buyers.find((b) => b.id === id);
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/** Finds an existing buyer by phone number, or creates a new profile — same
 *  de-duplication approach as findOrCreateSeller (no buyer login exists). */
export async function findOrCreateBuyer(input: BuyerInput): Promise<BuyerProfile> {
  const buyers = await getBuyers();
  const existing = buyers.find((b) => normalizePhone(b.phone) === normalizePhone(input.phone));
  if (existing) return existing;

  const buyer: BuyerProfile = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  buyers.unshift(buyer);
  await saveBuyers(buyers);
  return buyer;
}
