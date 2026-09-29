import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

/** Annonce publique "Recherché" — publiée par l'admin quand un client
 *  cherche une machine/pièce/moule précise (typiquement issu d'une demande
 *  "Recherche machine" reçue par WhatsApp ou le formulaire). Les visiteurs
 *  qui ont l'équipement peuvent répondre "J'ai ça" (voir /api/leads,
 *  type "offer"), sans jamais voir les coordonnées du demandeur. */
export type WantedCategory = "machine" | "piece" | "moule" | "autre";
export type WantedStatus = "draft" | "published";

export interface WantedListing {
  id: string;
  slug: string;
  title: string;
  category: WantedCategory;
  description: string;
  wilaya?: string;
  status: WantedStatus;
  createdAt: string;
}

export type WantedListingInput = {
  title: string;
  category: WantedCategory;
  description: string;
  wilaya?: string;
  status: WantedStatus;
};

const COLLECTION = "wantedListings";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string, existingSlugs: string[]): Promise<string> {
  let slug = base || "recherche";
  let counter = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${base || "recherche"}-${counter++}`;
  }
  return slug;
}

function buildListing(id: string, slug: string, input: WantedListingInput, now: string): WantedListing {
  return {
    id,
    slug,
    title: input.title,
    category: input.category,
    description: input.description,
    wilaya: input.wilaya || undefined,
    status: input.status,
    createdAt: now,
  };
}

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetWantedListings(): Promise<WantedListing[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as WantedListing);
}

async function dbAddWantedListing(input: WantedListingInput): Promise<WantedListing> {
  const db = getFirestoreAdmin();
  const existing = await db.collection(COLLECTION).select("slug").get();
  const baseSlug = slugify(input.title);
  const slug = await uniqueSlug(baseSlug, existing.docs.map((d) => d.get("slug") as string));
  const ref = db.collection(COLLECTION).doc();
  const now = new Date().toISOString();
  const listing = buildListing(ref.id, slug, input, now);
  await ref.set(listing);
  return listing;
}

async function dbUpdateWantedListing(id: string, patch: Partial<WantedListingInput>): Promise<WantedListing | null> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ ...patch });
  return (await ref.get()).data() as WantedListing;
}

async function dbDeleteWantedListing(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is NOT the production persistence: configure Firebase). -------

const DATA_DIR = path.join(os.tmpdir(), "jimi-wanted-listings-store");
const FILE = path.join(DATA_DIR, "wanted-listings.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetWantedListings(): Promise<WantedListing[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as WantedListing[];
  } catch {
    return [];
  }
}

async function fileSaveWantedListings(listings: WantedListing[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(listings, null, 2), "utf-8");
}

async function fileAddWantedListing(input: WantedListingInput): Promise<WantedListing> {
  const listings = await fileGetWantedListings();
  const baseSlug = slugify(input.title);
  const slug = await uniqueSlug(baseSlug, listings.map((l) => l.slug));
  const now = new Date().toISOString();
  const listing = buildListing(randomUUID(), slug, input, now);
  listings.unshift(listing);
  await fileSaveWantedListings(listings);
  return listing;
}

async function fileUpdateWantedListing(id: string, patch: Partial<WantedListingInput>): Promise<WantedListing | null> {
  const listings = await fileGetWantedListings();
  const index = listings.findIndex((l) => l.id === id);
  if (index === -1) return null;
  listings[index] = { ...listings[index], ...patch };
  await fileSaveWantedListings(listings);
  return listings[index];
}

async function fileDeleteWantedListing(id: string): Promise<void> {
  const listings = await fileGetWantedListings();
  await fileSaveWantedListings(listings.filter((l) => l.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getWantedListings(): Promise<WantedListing[]> {
  return isFirebaseConfigured() ? dbGetWantedListings() : fileGetWantedListings();
}

export async function getPublicWantedListings(): Promise<WantedListing[]> {
  const listings = await getWantedListings();
  return listings.filter((l) => l.status === "published");
}

export async function addWantedListing(input: WantedListingInput): Promise<WantedListing> {
  return isFirebaseConfigured() ? dbAddWantedListing(input) : fileAddWantedListing(input);
}

export async function updateWantedListing(id: string, patch: Partial<WantedListingInput>): Promise<WantedListing | null> {
  return isFirebaseConfigured() ? dbUpdateWantedListing(id, patch) : fileUpdateWantedListing(id, patch);
}

export async function deleteWantedListing(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteWantedListing(id) : fileDeleteWantedListing(id);
}
