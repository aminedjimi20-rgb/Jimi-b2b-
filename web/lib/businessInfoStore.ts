import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

/** Base de connaissances commerciale éditable depuis l'admin, utilisée
 *  par l'assistant IA pour répondre sans jamais inventer d'information. */
export interface FaqEntry {
  question: string;
  answer: string;
}

export interface BusinessInfo {
  /** Marques de machines/pièces avec lesquelles Jimi travaille. */
  brands: string[];
  /** Services proposés, en quelques mots chacun (ex. "Rénovation de presses à injection"). */
  services: string[];
  /** Zones d'intervention (wilayas ou régions). */
  interventionZones: string[];
  /** Conditions commerciales générales (délais de réponse, garanties, modalités de paiement...). */
  conditions: string;
  /** Questions fréquentes. */
  faq: FaqEntry[];
  /** Notes commerciales libres pour l'IA (ex. contexte à connaître, éléments à mettre en avant). */
  notes: string;
}

export const EMPTY_BUSINESS_INFO: BusinessInfo = {
  brands: [],
  services: [],
  interventionZones: [],
  conditions: "",
  faq: [],
  notes: "",
};

const DOC_PATH = ["settings", "businessInfo"] as const;

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetBusinessInfo(): Promise<BusinessInfo> {
  const snap = await getFirestoreAdmin().collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
  if (!snap.exists) return { ...EMPTY_BUSINESS_INFO };
  return { ...EMPTY_BUSINESS_INFO, ...(snap.data() as Partial<BusinessInfo>) };
}

async function dbSetBusinessInfo(value: BusinessInfo): Promise<void> {
  await getFirestoreAdmin().collection(DOC_PATH[0]).doc(DOC_PATH[1]).set(value);
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is not the production fix) -----------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-business-info-store");
const FILE = path.join(DATA_DIR, "businessInfo.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify(EMPTY_BUSINESS_INFO, null, 2), "utf-8");
  }
}

async function fileGetBusinessInfo(): Promise<BusinessInfo> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return { ...EMPTY_BUSINESS_INFO, ...(JSON.parse(raw) as Partial<BusinessInfo>) };
  } catch {
    return { ...EMPTY_BUSINESS_INFO };
  }
}

async function fileSetBusinessInfo(value: BusinessInfo): Promise<void> {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(value, null, 2), "utf-8");
}

// ---- Public API -------------------------------------------------------

export async function getBusinessInfo(): Promise<BusinessInfo> {
  return isFirebaseConfigured() ? dbGetBusinessInfo() : fileGetBusinessInfo();
}

export async function setBusinessInfo(value: BusinessInfo): Promise<void> {
  return isFirebaseConfigured() ? dbSetBusinessInfo(value) : fileSetBusinessInfo(value);
}
