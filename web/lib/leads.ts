import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type LeadType = "buy" | "sell" | "service" | "contact";

export interface Lead {
  id: string;
  type: LeadType;
  createdAt: string;
  status: "new" | "contacted" | "closed";
  data: Record<string, string>;
}

const DATA_DIR = path.join(process.cwd(), ".data");
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
  await ensureStore();
  const raw = await fs.readFile(LEADS_FILE, "utf-8");
  try {
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
