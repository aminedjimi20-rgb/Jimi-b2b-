import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "visit_scheduled"
  | "negotiation"
  | "sold"
  | "lost";

export type CommissionType = "percentage" | "fixed";
export type CommissionStatus = "pending" | "agreed" | "paid";

export interface Commission {
  type: CommissionType;
  value: number;
  expectedAmount: number | null;
  status: CommissionStatus;
}

export interface MachineLead {
  id: string;
  machineId: string;
  machineSlug: string;
  machineLabel: string;
  sellerId: string | null;
  buyerId: string;
  message: string;
  status: LeadStatus;
  commission: Commission;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MachineLeadInput = Pick<
  MachineLead,
  "machineId" | "machineSlug" | "machineLabel" | "sellerId" | "buyerId" | "message"
>;

type UpdatePatch = Partial<Pick<MachineLead, "status" | "adminNote">> & { commission?: Partial<Commission> };

const DEFAULT_COMMISSION: Commission = {
  type: "percentage",
  value: 0,
  expectedAmount: null,
  status: "pending",
};

const COLLECTION = "machineLeads";

// ---- Firestore-backed implementation (production) -------------------------

async function dbGetMachineLeads(): Promise<MachineLead[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as MachineLead);
}

async function dbAddMachineLead(input: MachineLeadInput): Promise<MachineLead> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc();
  const now = new Date().toISOString();
  const lead: MachineLead = {
    id: ref.id,
    ...input,
    status: "new",
    commission: { ...DEFAULT_COMMISSION },
    adminNote: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(lead);
  return lead;
}

async function dbUpdateMachineLead(id: string, patch: UpdatePatch): Promise<MachineLead | null> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const current = snap.data() as MachineLead;
  const { commission, ...rest } = patch;
  const next: MachineLead = {
    ...current,
    ...rest,
    commission: commission ? { ...current.commission, ...commission } : current.commission,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(next);
  return next;
}

async function dbDeleteMachineLead(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see lib/sellers.ts
// for why this is not the production fix) -----------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-machine-leads-store");
const FILE = path.join(DATA_DIR, "machine-leads.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetMachineLeads(): Promise<MachineLead[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as MachineLead[];
  } catch {
    return [];
  }
}

async function fileSaveMachineLeads(leads: MachineLead[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(leads, null, 2), "utf-8");
}

async function fileAddMachineLead(input: MachineLeadInput): Promise<MachineLead> {
  const leads = await fileGetMachineLeads();
  const now = new Date().toISOString();
  const lead: MachineLead = {
    id: randomUUID(),
    ...input,
    status: "new",
    commission: { ...DEFAULT_COMMISSION },
    adminNote: null,
    createdAt: now,
    updatedAt: now,
  };
  leads.unshift(lead);
  await fileSaveMachineLeads(leads);
  return lead;
}

async function fileUpdateMachineLead(id: string, patch: UpdatePatch): Promise<MachineLead | null> {
  const leads = await fileGetMachineLeads();
  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) return null;
  const current = leads[index];
  const { commission, ...rest } = patch;
  leads[index] = {
    ...current,
    ...rest,
    commission: commission ? { ...current.commission, ...commission } : current.commission,
    updatedAt: new Date().toISOString(),
  };
  await fileSaveMachineLeads(leads);
  return leads[index];
}

async function fileDeleteMachineLead(id: string): Promise<void> {
  const leads = await fileGetMachineLeads();
  await fileSaveMachineLeads(leads.filter((l) => l.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getMachineLeads(): Promise<MachineLead[]> {
  return isFirebaseConfigured() ? dbGetMachineLeads() : fileGetMachineLeads();
}

export async function addMachineLead(input: MachineLeadInput): Promise<MachineLead> {
  return isFirebaseConfigured() ? dbAddMachineLead(input) : fileAddMachineLead(input);
}

export async function updateMachineLead(id: string, patch: UpdatePatch): Promise<MachineLead | null> {
  return isFirebaseConfigured() ? dbUpdateMachineLead(id, patch) : fileUpdateMachineLead(id, patch);
}

export async function deleteMachineLead(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteMachineLead(id) : fileDeleteMachineLead(id);
}
