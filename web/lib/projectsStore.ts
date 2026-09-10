import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Project } from "@/lib/types";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

export type AdminProjectInput = {
  title: string;
  brand: string;
  tonnage: number;
  interventionType?: Project["interventionType"];
  problem: string;
  solution: string;
  result: string;
  status: Project["status"];
  videoUrl?: string | null;
  videoThumbnail?: string | null;
  videoTitle?: string | null;
  photos?: string[];
};

const COLLECTION = "projects";

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

function buildProject(id: string, slug: string, input: AdminProjectInput): Project {
  return {
    id,
    slug,
    title: input.title,
    brand: input.brand,
    tonnage: input.tonnage,
    interventionType: input.interventionType || undefined,
    problem: input.problem,
    solution: input.solution,
    result: input.result,
    status: input.status,
    videoUrl: input.videoUrl || null,
    videoThumbnail: input.videoThumbnail || null,
    videoTitle: input.videoTitle || null,
    photos: input.photos ?? [],
    isDemo: false,
  };
}

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetRuntimeProjects(): Promise<Project[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as Project);
}

async function dbAddRuntimeProject(input: AdminProjectInput): Promise<Project> {
  const db = getFirestoreAdmin();
  const existing = await db.collection(COLLECTION).select("slug").get();
  const baseSlug = slugify(`${input.title}-${input.brand}-${input.tonnage}t`);
  const slug = await uniqueSlug(
    baseSlug,
    existing.docs.map((d) => d.get("slug") as string)
  );

  const ref = db.collection(COLLECTION).doc();
  const project = buildProject(ref.id, slug, input);
  await ref.set({ ...project, createdAt: new Date().toISOString() });
  return project;
}

async function dbUpdateRuntimeProject(id: string, patch: Partial<AdminProjectInput>): Promise<Project | null> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ ...patch, updatedAt: new Date().toISOString() });
  return (await ref.get()).data() as Project;
}

async function dbDeleteRuntimeProject(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is not the production fix) -----------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-projects-store");
const FILE = path.join(DATA_DIR, "projects.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetRuntimeProjects(): Promise<Project[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

async function fileSaveRuntimeProjects(projects: Project[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(projects, null, 2), "utf-8");
}

async function fileAddRuntimeProject(input: AdminProjectInput): Promise<Project> {
  const projects = await fileGetRuntimeProjects();
  const baseSlug = slugify(`${input.title}-${input.brand}-${input.tonnage}t`);
  const slug = await uniqueSlug(baseSlug, projects.map((p) => p.slug));
  const project = buildProject(randomUUID(), slug, input);
  projects.unshift(project);
  await fileSaveRuntimeProjects(projects);
  return project;
}

async function fileUpdateRuntimeProject(id: string, patch: Partial<AdminProjectInput>): Promise<Project | null> {
  const projects = await fileGetRuntimeProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return null;
  projects[index] = { ...projects[index], ...patch };
  await fileSaveRuntimeProjects(projects);
  return projects[index];
}

async function fileDeleteRuntimeProject(id: string): Promise<void> {
  const projects = await fileGetRuntimeProjects();
  await fileSaveRuntimeProjects(projects.filter((p) => p.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getRuntimeProjects(): Promise<Project[]> {
  return isFirebaseConfigured() ? dbGetRuntimeProjects() : fileGetRuntimeProjects();
}

export async function addRuntimeProject(input: AdminProjectInput): Promise<Project> {
  return isFirebaseConfigured() ? dbAddRuntimeProject(input) : fileAddRuntimeProject(input);
}

export async function updateRuntimeProject(
  id: string,
  patch: Partial<AdminProjectInput>
): Promise<Project | null> {
  return isFirebaseConfigured() ? dbUpdateRuntimeProject(id, patch) : fileUpdateRuntimeProject(id, patch);
}

export async function deleteRuntimeProject(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteRuntimeProject(id) : fileDeleteRuntimeProject(id);
}
