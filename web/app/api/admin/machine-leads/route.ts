import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import {
  getMachineLeads,
  updateMachineLead,
  deleteMachineLead,
  type LeadStatus,
  type CommissionType,
  type CommissionStatus,
} from "@/lib/machineLeads";

const VALID_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "visit_scheduled",
  "negotiation",
  "sold",
  "lost",
];
const VALID_COMMISSION_TYPES: CommissionType[] = ["percentage", "fixed"];
const VALID_COMMISSION_STATUSES: CommissionStatus[] = ["pending", "agreed", "paid"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const leads = await getMachineLeads();
  return NextResponse.json({ leads });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const patch: Parameters<typeof updateMachineLead>[1] = {};

  if ("status" in body) {
    if (!VALID_STATUSES.includes(body.status as LeadStatus)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    patch.status = body.status as LeadStatus;
  }

  if ("adminNote" in body) {
    patch.adminNote = body.adminNote ? String(body.adminNote).slice(0, 1000) : null;
  }

  if (body.commission && typeof body.commission === "object") {
    const c = body.commission as Record<string, unknown>;
    const commission: Partial<import("@/lib/machineLeads").Commission> = {};
    if ("type" in c) {
      if (!VALID_COMMISSION_TYPES.includes(c.type as CommissionType)) {
        return NextResponse.json({ error: "invalid_commission_type" }, { status: 400 });
      }
      commission.type = c.type as CommissionType;
    }
    if ("value" in c) {
      const value = Number(c.value);
      commission.value = Number.isFinite(value) && value >= 0 ? value : 0;
    }
    if ("expectedAmount" in c) {
      const amount = Number(c.expectedAmount);
      commission.expectedAmount = Number.isFinite(amount) && amount > 0 ? amount : null;
    }
    if ("status" in c) {
      if (!VALID_COMMISSION_STATUSES.includes(c.status as CommissionStatus)) {
        return NextResponse.json({ error: "invalid_commission_status" }, { status: 400 });
      }
      commission.status = c.status as CommissionStatus;
    }
    patch.commission = commission;
  }

  const lead = await updateMachineLead(body.id, patch);
  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lead });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  await deleteMachineLead(id);
  return NextResponse.json({ ok: true });
}
