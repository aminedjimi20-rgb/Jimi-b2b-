import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Part } from "@/lib/types";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

export type AdminPartInput = {
  category: Part["category"];
  name: string;
  reference: string;
  brand?: string;
  model?: string;
  wilaya?: string;
  description: string;
  condition: Part["condition"];
  status: Part["status"];
  price: number | null;
  priceOnRequest: boolean;
  photos?: string[];
  isPromo?: boolean;
};

const COLLECTION = "parts";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string, existingSlugs: string[]): Promise<string> {
  let slug = base;
  let counter = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

function buildPart(id: string, slug: string, input: AdminPartInput): Part {
  return {
    id,
    slug,
    category: input.category,
    name: input.name,
    reference: input.reference,
    brand: input.brand || undefined,
    model: input.model || undefined,
    wilaya: input.wilaya || undefined,
    description: input.description,
    condition: input.condition,
    price: input.price,
    priceOnRequest: input.priceOnRequest,
    photos: input.photos ?? [],
    status: input.status,
    isDemo: false,
    isPromo: input.isPromo ?? false,
  };
}

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetRuntimeParts(): Promise<Part[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as Part);
}

async function dbAddRuntimePart(input: AdminPartInput): Promise<Part> {
  const db = getFirestoreAdmin();
  const existing = await db.collection(COLLECTION).select("slug").get();
  const baseSlug = slugify(`${input.category}-${input.name}-${input.reference}`);
  const slug = await uniqueSlug(
    baseSlug,
    existing.docs.map((d) => d.get("slug") as string)
  );

  const ref = db.collection(COLLECTION).doc();
  const part = buildPart(ref.id, slug, input);
  await ref.set({ ...part, createdAt: new Date().toISOString() });
  return part;
}

async function dbUpdateRuntimePart(id: string, patch: Partial<AdminPartInput>): Promise<Part | null> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ ...patch, updatedAt: new Date().toISOString() });
  return (await ref.get()).data() as Part;
}

async function dbDeleteRuntimePart(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is NOT the production persistence: configure Firebase). -------

const DATA_DIR = path.join(os.tmpdir(), "jimi-parts-store");
const FILE = path.join(DATA_DIR, "parts.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetRuntimeParts(): Promise<Part[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as Part[];
  } catch {
    return [];
  }
}

async function fileSaveRuntimeParts(parts: Part[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(parts, null, 2), "utf-8");
}

async function fileAddRuntimePart(input: AdminPartInput): Promise<Part> {
  const parts = await fileGetRuntimeParts();
  const baseSlug = slugify(`${input.category}-${input.name}-${input.reference}`);
  const slug = await uniqueSlug(baseSlug, parts.map((p) => p.slug));
  const part = buildPart(randomUUID(), slug, input);
  parts.unshift(part);
  await fileSaveRuntimeParts(parts);
  return part;
}

async function fileUpdateRuntimePart(id: string, patch: Partial<AdminPartInput>): Promise<Part | null> {
  const parts = await fileGetRuntimeParts();
  const index = parts.findIndex((p) => p.id === id);
  if (index === -1) return null;
  parts[index] = { ...parts[index], ...patch };
  await fileSaveRuntimeParts(parts);
  return parts[index];
}

async function fileDeleteRuntimePart(id: string): Promise<void> {
  const parts = await fileGetRuntimeParts();
  await fileSaveRuntimeParts(parts.filter((p) => p.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getRuntimeParts(): Promise<Part[]> {
  return isFirebaseConfigured() ? dbGetRuntimeParts() : fileGetRuntimeParts();
}

export async function addRuntimePart(input: AdminPartInput): Promise<Part> {
  return isFirebaseConfigured() ? dbAddRuntimePart(input) : fileAddRuntimePart(input);
}

export async function updateRuntimePart(id: string, patch: Partial<AdminPartInput>): Promise<Part | null> {
  return isFirebaseConfigured() ? dbUpdateRuntimePart(id, patch) : fileUpdateRuntimePart(id, patch);
}

export async function deleteRuntimePart(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteRuntimePart(id) : fileDeleteRuntimePart(id);
}
