import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Testimonial } from "@/lib/types";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

export type AdminTestimonialInput = {
  name: string;
  company?: string | null;
  message: string;
  rating: number;
  status: Testimonial["status"];
};

export type PublicTestimonialInput = {
  name: string;
  company?: string | null;
  message: string;
  rating: number;
};

const COLLECTION = "testimonials";

function buildTestimonial(id: string, input: AdminTestimonialInput): Testimonial {
  return {
    id,
    name: input.name,
    company: input.company || null,
    message: input.message,
    rating: input.rating,
    status: input.status,
    submittedAt: new Date().toISOString(),
    isDemo: false,
  };
}

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetRuntimeTestimonials(): Promise<Testimonial[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as Testimonial);
}

async function dbAddRuntimeTestimonial(input: AdminTestimonialInput): Promise<Testimonial> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc();
  const testimonial = buildTestimonial(ref.id, input);
  await ref.set({ ...testimonial, createdAt: new Date().toISOString() });
  return testimonial;
}

async function dbSubmitTestimonialForReview(input: PublicTestimonialInput): Promise<Testimonial> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc();
  const testimonial = buildTestimonial(ref.id, { ...input, status: "pending" });
  await ref.set({ ...testimonial, createdAt: new Date().toISOString() });
  return testimonial;
}

async function dbUpdateRuntimeTestimonial(
  id: string,
  patch: Partial<AdminTestimonialInput>
): Promise<Testimonial | null> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ ...patch, updatedAt: new Date().toISOString() });
  return (await ref.get()).data() as Testimonial;
}

async function dbDeleteRuntimeTestimonial(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is not the production fix) -----------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-testimonials-store");
const FILE = path.join(DATA_DIR, "testimonials.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetRuntimeTestimonials(): Promise<Testimonial[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as Testimonial[];
  } catch {
    return [];
  }
}

async function fileSaveRuntimeTestimonials(testimonials: Testimonial[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(testimonials, null, 2), "utf-8");
}

async function fileAddRuntimeTestimonial(input: AdminTestimonialInput): Promise<Testimonial> {
  const testimonials = await fileGetRuntimeTestimonials();
  const testimonial = buildTestimonial(randomUUID(), input);
  testimonials.unshift(testimonial);
  await fileSaveRuntimeTestimonials(testimonials);
  return testimonial;
}

async function fileSubmitTestimonialForReview(input: PublicTestimonialInput): Promise<Testimonial> {
  const testimonials = await fileGetRuntimeTestimonials();
  const testimonial = buildTestimonial(randomUUID(), { ...input, status: "pending" });
  testimonials.unshift(testimonial);
  await fileSaveRuntimeTestimonials(testimonials);
  return testimonial;
}

async function fileUpdateRuntimeTestimonial(
  id: string,
  patch: Partial<AdminTestimonialInput>
): Promise<Testimonial | null> {
  const testimonials = await fileGetRuntimeTestimonials();
  const index = testimonials.findIndex((t) => t.id === id);
  if (index === -1) return null;
  testimonials[index] = { ...testimonials[index], ...patch };
  await fileSaveRuntimeTestimonials(testimonials);
  return testimonials[index];
}

async function fileDeleteRuntimeTestimonial(id: string): Promise<void> {
  const testimonials = await fileGetRuntimeTestimonials();
  await fileSaveRuntimeTestimonials(testimonials.filter((t) => t.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getRuntimeTestimonials(): Promise<Testimonial[]> {
  return isFirebaseConfigured() ? dbGetRuntimeTestimonials() : fileGetRuntimeTestimonials();
}

export async function addRuntimeTestimonial(input: AdminTestimonialInput): Promise<Testimonial> {
  return isFirebaseConfigured() ? dbAddRuntimeTestimonial(input) : fileAddRuntimeTestimonial(input);
}

/** Public "leave a testimonial" submission — always lands as PENDING,
 *  invisible on the site until an admin approves it. */
export async function submitTestimonialForReview(input: PublicTestimonialInput): Promise<Testimonial> {
  return isFirebaseConfigured() ? dbSubmitTestimonialForReview(input) : fileSubmitTestimonialForReview(input);
}

export async function updateRuntimeTestimonial(
  id: string,
  patch: Partial<AdminTestimonialInput>
): Promise<Testimonial | null> {
  return isFirebaseConfigured()
    ? dbUpdateRuntimeTestimonial(id, patch)
    : fileUpdateRuntimeTestimonial(id, patch);
}

export async function deleteRuntimeTestimonial(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteRuntimeTestimonial(id) : fileDeleteRuntimeTestimonial(id);
}
