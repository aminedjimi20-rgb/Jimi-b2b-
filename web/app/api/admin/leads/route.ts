import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getLeads, updateLeadStatus, deleteLead, type Lead } from "@/lib/leads";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const leads = await getLeads();
  return NextResponse.json({ leads });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { id?: string; status?: Lead["status"] } | null;
  if (!body?.id || !body.status) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  await updateLeadStatus(body.id, body.status);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  await deleteLead(id);
  return NextResponse.json({ ok: true });
}
