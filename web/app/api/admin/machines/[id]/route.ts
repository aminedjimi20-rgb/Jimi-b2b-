import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { updateRuntimeMachine, deleteRuntimeMachine, type AdminMachineInput } from "@/lib/machinesStore";
import { sanitizeUrl } from "@/lib/sanitize";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Partial<AdminMachineInput> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if ("videoUrl" in body) body.videoUrl = sanitizeUrl(body.videoUrl);
  if ("videoThumbnail" in body) body.videoThumbnail = sanitizeUrl(body.videoThumbnail);
  if ("videoTitle" in body) {
    body.videoTitle = body.videoTitle ? String(body.videoTitle).slice(0, 200) : null;
  }
  const machine = await updateRuntimeMachine(id, body);
  if (!machine) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, machine });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await deleteRuntimeMachine(id);
  return NextResponse.json({ ok: true });
}
