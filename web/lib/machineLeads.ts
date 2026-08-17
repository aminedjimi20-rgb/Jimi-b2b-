import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

// Same ephemeral-tmpdir pattern as the other admin-only stores. A
// MachineLead is the deal record that ties a Buyer, a Machine, and its
// Seller together — the core of Jimi's intermediation workflow. Never
// exposed on any public page or public API response.
const DATA_DIR = path.join(os.tmpdir(), "jimi-machine-leads-store");
const FILE = path.join(DATA_DIR, "machine-leads.json");

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

const DEFAULT_COMMISSION: Commission = {
  type: "percentage",
  value: 0,
  expectedAmount: null,
  status: "pending",
};

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

export async function getMachineLeads(): Promise<MachineLead[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as MachineLead[];
  } catch {
    return [];
  }
}

async function saveMachineLeads(leads: MachineLead[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(leads, null, 2), "utf-8");
}

export async function addMachineLead(input: MachineLeadInput): Promise<MachineLead> {
  const leads = await getMachineLeads();
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
  await saveMachineLeads(leads);
  return lead;
}

export async function updateMachineLead(
  id: string,
  patch: Partial<Pick<MachineLead, "status" | "adminNote">> & { commission?: Partial<Commission> }
): Promise<MachineLead | null> {
  const leads = await getMachineLeads();
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
  await saveMachineLeads(leads);
  return leads[index];
}

export async function deleteMachineLead(id: string): Promise<void> {
  const leads = await getMachineLeads();
  await saveMachineLeads(leads.filter((l) => l.id !== id));
}
