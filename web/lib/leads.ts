import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export type LeadType = "buy" | "sell" | "service" | "contact";

export interface Lead {
  id: string;
  type: LeadType;
  createdAt: string;
  status: "new" | "contacted" | "closed";
  data: Record<string, string>;
}

function fromRow(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    type: row.type as LeadType,
    createdAt: row.created_at as string,
    status: row.status as Lead["status"],
    data: (row.data as Record<string, string>) ?? {},
  };
}

// ---- Supabase-backed implementation (production) --------------------------

async function dbGetLeads(): Promise<Lead[]> {
  const { data, error } = await getSupabaseAdmin().from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

async function dbAddLead(type: LeadType, data: Record<string, string>): Promise<Lead> {
  const { data: row, error } = await getSupabaseAdmin()
    .from("leads")
    .insert({ type, status: "new", data })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(row);
}

async function dbUpdateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  await getSupabaseAdmin().from("leads").update({ status }).eq("id", id);
}

async function dbDeleteLead(id: string): Promise<void> {
  await getSupabaseAdmin().from("leads").delete().eq("id", id);
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
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
  return isSupabaseConfigured() ? dbGetLeads() : fileGetLeads();
}

export async function addLead(type: LeadType, data: Record<string, string>): Promise<Lead> {
  return isSupabaseConfigured() ? dbAddLead(type, data) : fileAddLead(type, data);
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  return isSupabaseConfigured() ? dbUpdateLeadStatus(id, status) : fileUpdateLeadStatus(id, status);
}

export async function deleteLead(id: string): Promise<void> {
  return isSupabaseConfigured() ? dbDeleteLead(id) : fileDeleteLead(id);
}
