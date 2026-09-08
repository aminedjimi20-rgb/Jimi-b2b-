import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

export type ServiceVideoKey = "renovation" | "automation" | "maintenance";

export interface ServiceVideo {
  videoUrl: string;
  videoTitle: string | null;
  videoThumbnail: string | null;
}

export type ServiceVideos = Record<ServiceVideoKey, ServiceVideo | null>;

const KEYS: ServiceVideoKey[] = ["renovation", "automation", "maintenance"];
const EMPTY: ServiceVideos = { renovation: null, automation: null, maintenance: null };

const DOC_PATH = ["settings", "serviceVideos"] as const;

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetServiceVideos(): Promise<ServiceVideos> {
  const snap = await getFirestoreAdmin().collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
  if (!snap.exists) return { ...EMPTY };
  const data = snap.data() as Partial<ServiceVideos>;
  return { ...EMPTY, ...data };
}

async function dbSetServiceVideo(key: ServiceVideoKey, value: ServiceVideo | null): Promise<void> {
  await getFirestoreAdmin()
    .collection(DOC_PATH[0])
    .doc(DOC_PATH[1])
    .set({ [key]: value }, { merge: true });
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is not the production fix) -----------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-service-videos-store");
const FILE = path.join(DATA_DIR, "serviceVideos.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify(EMPTY, null, 2), "utf-8");
  }
}

async function fileGetServiceVideos(): Promise<ServiceVideos> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<ServiceVideos>) };
  } catch {
    return { ...EMPTY };
  }
}

async function fileSetServiceVideo(key: ServiceVideoKey, value: ServiceVideo | null): Promise<void> {
  const current = await fileGetServiceVideos();
  current[key] = value;
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(current, null, 2), "utf-8");
}

// ---- Public API -------------------------------------------------------

export async function getServiceVideos(): Promise<ServiceVideos> {
  return isFirebaseConfigured() ? dbGetServiceVideos() : fileGetServiceVideos();
}

export async function getServiceVideo(key: ServiceVideoKey): Promise<ServiceVideo | null> {
  const videos = await getServiceVideos();
  return videos[key];
}

export async function setServiceVideo(key: ServiceVideoKey, value: ServiceVideo | null): Promise<void> {
  if (!KEYS.includes(key)) throw new Error("invalid_service_key");
  return isFirebaseConfigured() ? dbSetServiceVideo(key, value) : fileSetServiceVideo(key, value);
}
