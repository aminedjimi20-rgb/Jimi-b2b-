import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

export type LeadType = "buy" | "sell" | "service" | "contact";

export interface Lead {
  id: string;
  type: LeadType;
  createdAt: string;
  status: "new" | "contacted" | "closed";
  data: Record<string, string>;
}

const COLLECTION = "leads";

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetLeads(): Promise<Lead[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as Lead);
}

async function dbAddLead(type: LeadType, data: Record<string, string>): Promise<Lead> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc();
  const lead: Lead = { id: ref.id, type, createdAt: new Date().toISOString(), status: "new", data };
  await ref.set(lead);
  return lead;
}

async function dbUpdateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).update({ status });
}

async function dbDeleteLead(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see lib/sellers.ts
// for why this is not the production fix) -----------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-leads");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(LEADS_FILE);
  } catch {
    await fs.writeFile(LEADS_FILE, "[]", "utf-8");
  }
}

async function fileGetLeads(): Promise<Lead[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(LEADS_FILE, "utf-8");
    return JSON.parse(raw) as Lead[];
  } catch {
    return [];
  }
}

async function fileAddLead(type: LeadType, data: Record<string, string>): Promise<Lead> {
  await ensureStore();
  const leads = await fileGetLeads();
  const lead: Lead = { id: randomUUID(), type, createdAt: new Date().toISOString(), status: "new", data };
  leads.unshift(lead);
  await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
  return lead;
}

async function fileUpdateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  const leads = await fileGetLeads();
  const next = leads.map((l) => (l.id === id ? { ...l, status } : l));
  await fs.writeFile(LEADS_FILE, JSON.stringify(next, null, 2), "utf-8");
}

async function fileDeleteLead(id: string): Promise<void> {
  const leads = await fileGetLeads();
  const next = leads.filter((l) => l.id !== id);
  await fs.writeFile(LEADS_FILE, JSON.stringify(next, null, 2), "utf-8");
}

// ---- Public API -------------------------------------------------------

export async function getLeads(): Promise<Lead[]> {
  return isFirebaseConfigured() ? dbGetLeads() : fileGetLeads();
}

export async function addLead(type: LeadType, data: Record<string, string>): Promise<Lead> {
  return isFirebaseConfigured() ? dbAddLead(type, data) : fileAddLead(type, data);
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  return isFirebaseConfigured() ? dbUpdateLeadStatus(id, status) : fileUpdateLeadStatus(id, status);
}

export async function deleteLead(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteLead(id) : fileDeleteLead(id);
}
