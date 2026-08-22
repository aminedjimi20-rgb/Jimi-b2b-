import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Machine } from "@/lib/types";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

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

const COLLECTION = "machines";

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

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetRuntimeMachines(): Promise<Machine[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as Machine);
}

async function dbAddRuntimeMachine(input: AdminMachineInput): Promise<Machine> {
  const db = getFirestoreAdmin();
  const existing = await db.collection(COLLECTION).select("slug").get();
  const baseSlug = slugify(`${input.brand}-${input.model}-${input.tonnage}t-${input.year}`);
  const slug = await uniqueSlug(
    baseSlug,
    existing.docs.map((d) => d.get("slug") as string)
  );

  const ref = db.collection(COLLECTION).doc();
  const now = new Date().toISOString();
  const machine: Machine = {
    id: ref.id,
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
    submittedAt: now,
    reviewedAt: now,
  };
  await ref.set({ ...machine, createdAt: now });
  return machine;
}

async function dbSubmitMachineForReview(input: SellerListingInput): Promise<Machine> {
  const db = getFirestoreAdmin();
  const existing = await db.collection(COLLECTION).select("slug").get();
  const baseSlug = slugify(`${input.brand}-${input.model}-${input.tonnage}t-${input.year ?? "na"}`);
  const slug = await uniqueSlug(
    baseSlug,
    existing.docs.map((d) => d.get("slug") as string)
  );

  const ref = db.collection(COLLECTION).doc();
  const now = new Date().toISOString();
  const machine: Machine = {
    id: ref.id,
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
    submittedAt: now,
    reviewedAt: null,
  };
  await ref.set({ ...machine, createdAt: now });
  return machine;
}

async function dbUpdateRuntimeMachine(id: string, patch: Partial<AdminMachineInput>): Promise<Machine | null> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ ...patch, updatedAt: new Date().toISOString() });
  return (await ref.get()).data() as Machine;
}

async function dbDeleteRuntimeMachine(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — NOT the production
// fix; on Vercel each serverless invocation can run in a different
// container, so os.tmpdir() writes are NOT guaranteed visible to the next
// request. This is exactly why machines vanished after Approve: without
// Firebase configured, "persistence" here only holds within one warm
// instance. Configure FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
// FIREBASE_PRIVATE_KEY in production — see web/firebase/README.md.) --------

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
  return isFirebaseConfigured() ? dbGetRuntimeMachines() : fileGetRuntimeMachines();
}

export async function addRuntimeMachine(input: AdminMachineInput): Promise<Machine> {
  return isFirebaseConfigured() ? dbAddRuntimeMachine(input) : fileAddRuntimeMachine(input);
}

/** Public "sell my machine" submission — always lands as PENDING, invisible on the site
 *  until an admin approves it via `updateRuntimeMachine`. */
export async function submitMachineForReview(input: SellerListingInput): Promise<Machine> {
  return isFirebaseConfigured() ? dbSubmitMachineForReview(input) : fileSubmitMachineForReview(input);
}

export async function updateRuntimeMachine(
  id: string,
  patch: Partial<AdminMachineInput>
): Promise<Machine | null> {
  return isFirebaseConfigured() ? dbUpdateRuntimeMachine(id, patch) : fileUpdateRuntimeMachine(id, patch);
}

export async function deleteRuntimeMachine(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteRuntimeMachine(id) : fileDeleteRuntimeMachine(id);
}
