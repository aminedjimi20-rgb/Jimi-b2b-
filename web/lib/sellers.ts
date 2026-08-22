import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

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

const COLLECTION = "sellers";

// ---- Firestore-backed implementation (production) -------------------------

async function dbGetSellers(): Promise<SellerProfile[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as SellerProfile);
}

async function dbFindOrCreateSeller(input: SellerInput): Promise<SellerProfile> {
  const db = getFirestoreAdmin();
  const phoneNormalized = normalizePhone(input.phone);
  const existing = await db.collection(COLLECTION).where("phoneNormalized", "==", phoneNormalized).limit(1).get();
  if (!existing.empty) return existing.docs[0].data() as SellerProfile;

  const ref = db.collection(COLLECTION).doc();
  const seller: SellerProfile = { id: ref.id, createdAt: new Date().toISOString(), ...input };
  await ref.set({ ...seller, phoneNormalized });
  return seller;
}

async function dbUpdateSeller(id: string, patch: Partial<SellerInput>): Promise<SellerProfile | null> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const update: Record<string, unknown> = { ...patch };
  if (patch.phone) update.phoneNormalized = normalizePhone(patch.phone);
  await ref.update(update);
  return (await ref.get()).data() as SellerProfile;
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

async function fileUpdateSeller(id: string, patch: Partial<SellerInput>): Promise<SellerProfile | null> {
  const sellers = await fileGetSellers();
  const index = sellers.findIndex((s) => s.id === id);
  if (index === -1) return null;
  sellers[index] = { ...sellers[index], ...patch };
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(sellers, null, 2), "utf-8");
  return sellers[index];
}

// ---- Public API -------------------------------------------------------

export async function getSellers(): Promise<SellerProfile[]> {
  return isFirebaseConfigured() ? dbGetSellers() : fileGetSellers();
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
  return isFirebaseConfigured() ? dbFindOrCreateSeller(input) : fileFindOrCreateSeller(input);
}

export async function updateSeller(id: string, patch: Partial<SellerInput>): Promise<SellerProfile | null> {
  return isFirebaseConfigured() ? dbUpdateSeller(id, patch) : fileUpdateSeller(id, patch);
}
