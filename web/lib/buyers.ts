import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

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

const COLLECTION = "buyers";

// ---- Firestore-backed implementation (production) -------------------------

async function dbGetBuyers(): Promise<BuyerProfile[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as BuyerProfile);
}

async function dbFindOrCreateBuyer(input: BuyerInput): Promise<BuyerProfile> {
  const db = getFirestoreAdmin();
  const phoneNormalized = normalizePhone(input.phone);
  const existing = await db.collection(COLLECTION).where("phoneNormalized", "==", phoneNormalized).limit(1).get();
  if (!existing.empty) return existing.docs[0].data() as BuyerProfile;

  const ref = db.collection(COLLECTION).doc();
  const buyer: BuyerProfile = { id: ref.id, createdAt: new Date().toISOString(), ...input };
  await ref.set({ ...buyer, phoneNormalized });
  return buyer;
}

// ---- Ephemeral file-based fallback (local dev only — see lib/sellers.ts
// for why this is not the production fix) -----------------------------

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
  return isFirebaseConfigured() ? dbGetBuyers() : fileGetBuyers();
}

export async function getBuyerById(id: string): Promise<BuyerProfile | undefined> {
  const buyers = await getBuyers();
  return buyers.find((b) => b.id === id);
}

/** Finds an existing buyer by phone number, or creates a new profile — same
 *  de-duplication approach as findOrCreateSeller (no buyer login exists). */
export async function findOrCreateBuyer(input: BuyerInput): Promise<BuyerProfile> {
  return isFirebaseConfigured() ? dbFindOrCreateBuyer(input) : fileFindOrCreateBuyer(input);
}
