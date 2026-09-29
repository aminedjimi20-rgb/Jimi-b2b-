import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

/** Logos des entreprises/partenaires affichés en bandeau public (footer) —
 *  "Ils nous font confiance". Gérés depuis l'admin (onglet Paramètres). */
export interface PartnerLogo {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl?: string;
  createdAt: string;
}

export type PartnerLogoInput = {
  name: string;
  logoUrl: string;
  websiteUrl?: string;
};

const COLLECTION = "partnerLogos";

function buildLogo(id: string, input: PartnerLogoInput, now: string): PartnerLogo {
  return {
    id,
    name: input.name,
    logoUrl: input.logoUrl,
    websiteUrl: input.websiteUrl || undefined,
    createdAt: now,
  };
}

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetPartnerLogos(): Promise<PartnerLogo[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as PartnerLogo);
}

async function dbAddPartnerLogo(input: PartnerLogoInput): Promise<PartnerLogo> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc();
  const now = new Date().toISOString();
  const logo = buildLogo(ref.id, input, now);
  await ref.set(logo);
  return logo;
}

async function dbDeletePartnerLogo(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is NOT the production persistence: configure Firebase). -------

const DATA_DIR = path.join(os.tmpdir(), "jimi-partner-logos-store");
const FILE = path.join(DATA_DIR, "partner-logos.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetPartnerLogos(): Promise<PartnerLogo[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as PartnerLogo[];
  } catch {
    return [];
  }
}

async function fileSavePartnerLogos(logos: PartnerLogo[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(logos, null, 2), "utf-8");
}

async function fileAddPartnerLogo(input: PartnerLogoInput): Promise<PartnerLogo> {
  const logos = await fileGetPartnerLogos();
  const now = new Date().toISOString();
  const logo = buildLogo(randomUUID(), input, now);
  logos.unshift(logo);
  await fileSavePartnerLogos(logos);
  return logo;
}

async function fileDeletePartnerLogo(id: string): Promise<void> {
  const logos = await fileGetPartnerLogos();
  await fileSavePartnerLogos(logos.filter((l) => l.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getPartnerLogos(): Promise<PartnerLogo[]> {
  return isFirebaseConfigured() ? dbGetPartnerLogos() : fileGetPartnerLogos();
}

export async function addPartnerLogo(input: PartnerLogoInput): Promise<PartnerLogo> {
  return isFirebaseConfigured() ? dbAddPartnerLogo(input) : fileAddPartnerLogo(input);
}

export async function deletePartnerLogo(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeletePartnerLogo(id) : fileDeletePartnerLogo(id);
}
