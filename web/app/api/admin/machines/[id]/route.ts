import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { updateRuntimeMachine, deleteRuntimeMachine, type AdminMachineInput } from "@/lib/machinesStore";
import { sanitizeUrl } from "@/lib/sanitize";
import type { ModerationStatus } from "@/lib/types";

const VALID_MODERATION_STATUSES: ModerationStatus[] = ["pending", "published", "rejected", "draft"];

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
  if ("photos" in body) {
    body.photos = Array.isArray(body.photos)
      ? body.photos.map((p) => sanitizeUrl(p)).filter((p): p is string => Boolean(p)).slice(0, 10)
      : [];
  }
  if ("adminNote" in body) {
    body.adminNote = body.adminNote ? String(body.adminNote).slice(0, 1000) : null;
  }
  if ("moderationStatus" in body) {
    if (!VALID_MODERATION_STATUSES.includes(body.moderationStatus as ModerationStatus)) {
      return NextResponse.json({ error: "invalid_moderation_status" }, { status: 400 });
    }
    body.reviewedAt = new Date().toISOString();
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
