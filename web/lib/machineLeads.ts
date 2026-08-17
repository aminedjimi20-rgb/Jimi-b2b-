import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

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

function fromRow(row: Record<string, unknown>): MachineLead {
  return {
    id: row.id as string,
    machineId: row.machine_id as string,
    machineSlug: row.machine_slug as string,
    machineLabel: row.machine_label as string,
    sellerId: (row.seller_id as string | null) ?? null,
    buyerId: row.buyer_id as string,
    message: (row.message as string) ?? "",
    status: row.status as LeadStatus,
    commission: {
      type: row.commission_type as CommissionType,
      value: Number(row.commission_value ?? 0),
      expectedAmount: row.commission_expected_amount === null ? null : Number(row.commission_expected_amount),
      status: row.commission_status as CommissionStatus,
    },
    adminNote: (row.admin_note as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

type UpdatePatch = Partial<Pick<MachineLead, "status" | "adminNote">> & { commission?: Partial<Commission> };

function toUpdateRow(patch: UpdatePatch): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("status" in patch) row.status = patch.status;
  if ("adminNote" in patch) row.admin_note = patch.adminNote;
  if (patch.commission) {
    if ("type" in patch.commission) row.commission_type = patch.commission.type;
    if ("value" in patch.commission) row.commission_value = patch.commission.value;
    if ("expectedAmount" in patch.commission) row.commission_expected_amount = patch.commission.expectedAmount;
    if ("status" in patch.commission) row.commission_status = patch.commission.status;
  }
  return row;
}

// ---- Supabase-backed implementation (production) --------------------------

async function dbGetMachineLeads(): Promise<MachineLead[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("machine_leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

async function dbAddMachineLead(input: MachineLeadInput): Promise<MachineLead> {
  const { data, error } = await getSupabaseAdmin()
    .from("machine_leads")
    .insert({
      machine_id: input.machineId,
      machine_slug: input.machineSlug,
      machine_label: input.machineLabel,
      seller_id: input.sellerId,
      buyer_id: input.buyerId,
      message: input.message,
      status: "new",
      commission_type: DEFAULT_COMMISSION.type,
      commission_value: DEFAULT_COMMISSION.value,
      commission_status: DEFAULT_COMMISSION.status,
    })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

async function dbUpdateMachineLead(id: string, patch: UpdatePatch): Promise<MachineLead | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("machine_leads")
    .update(toUpdateRow(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) return null;
  return fromRow(data);
}

async function dbDeleteMachineLead(id: string): Promise<void> {
  await getSupabaseAdmin().from("machine_leads").delete().eq("id", id);
}

// ---- Ephemeral file-based fallback (local dev only — NOT the production
// fix; data does not survive across Vercel serverless instances) -----------

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
  return isSupabaseConfigured() ? dbGetMachineLeads() : fileGetMachineLeads();
}

export async function addMachineLead(input: MachineLeadInput): Promise<MachineLead> {
  return isSupabaseConfigured() ? dbAddMachineLead(input) : fileAddMachineLead(input);
}

export async function updateMachineLead(id: string, patch: UpdatePatch): Promise<MachineLead | null> {
  return isSupabaseConfigured() ? dbUpdateMachineLead(id, patch) : fileUpdateMachineLead(id, patch);
}

export async function deleteMachineLead(id: string): Promise<void> {
  return isSupabaseConfigured() ? dbDeleteMachineLead(id) : fileDeleteMachineLead(id);
}
