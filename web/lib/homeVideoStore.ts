import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

/** Vidéo explicative optionnelle affichée sur la page d'accueil (juste après
 *  les 3 cartes "Que souhaitez-vous faire ?"), envoyée par l'admin depuis la
 *  galerie de son téléphone — pas de section affichée tant qu'aucune vidéo
 *  n'est configurée. */
export interface HomeVideo {
  videoUrl: string | null;
  videoTitle: string | null;
}

const EMPTY: HomeVideo = { videoUrl: null, videoTitle: null };
const DOC_PATH = ["settings", "homeVideo"] as const;

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetHomeVideo(): Promise<HomeVideo> {
  const snap = await getFirestoreAdmin().collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
  if (!snap.exists) return { ...EMPTY };
  return { ...EMPTY, ...(snap.data() as Partial<HomeVideo>) };
}

async function dbSetHomeVideo(value: HomeVideo): Promise<void> {
  await getFirestoreAdmin().collection(DOC_PATH[0]).doc(DOC_PATH[1]).set(value);
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is not the production fix) -----------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-home-video-store");
const FILE = path.join(DATA_DIR, "homeVideo.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify(EMPTY, null, 2), "utf-8");
  }
}

async function fileGetHomeVideo(): Promise<HomeVideo> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<HomeVideo>) };
  } catch {
    return { ...EMPTY };
  }
}

async function fileSetHomeVideo(value: HomeVideo): Promise<void> {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(value, null, 2), "utf-8");
}

// ---- Public API -------------------------------------------------------

export async function getHomeVideo(): Promise<HomeVideo> {
  return isFirebaseConfigured() ? dbGetHomeVideo() : fileGetHomeVideo();
}

export async function setHomeVideo(value: HomeVideo): Promise<void> {
  return isFirebaseConfigured() ? dbSetHomeVideo(value) : fileSetHomeVideo(value);
}
