import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

export type LeadType = "buy" | "sell" | "service" | "contact";

export interface Lead {
  id: string;
  type: LeadType;
  createdAt: string;
  status: "new" | "contacted" | "closed";
  data: Record<string, string>;
}

// Serverless platforms (Vercel, etc.) only allow writes under the OS temp
// directory — the deployed app bundle itself is read-only. This store is
// therefore ephemeral by design; see web/README.md for the production
// migration path (a real database).
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

export async function getLeads(): Promise<Lead[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(LEADS_FILE, "utf-8");
    return JSON.parse(raw) as Lead[];
  } catch {
    return [];
  }
}

export async function addLead(type: LeadType, data: Record<string, string>): Promise<Lead> {
  await ensureStore();
  const leads = await getLeads();
  const lead: Lead = {
    id: randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    status: "new",
    data,
  };
  leads.unshift(lead);
  await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
  return lead;
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  const leads = await getLeads();
  const next = leads.map((l) => (l.id === id ? { ...l, status } : l));
  await fs.writeFile(LEADS_FILE, JSON.stringify(next, null, 2), "utf-8");
}

export async function deleteLead(id: string): Promise<void> {
  const leads = await getLeads();
  const next = leads.filter((l) => l.id !== id);
  await fs.writeFile(LEADS_FILE, JSON.stringify(next, null, 2), "utf-8");
}
