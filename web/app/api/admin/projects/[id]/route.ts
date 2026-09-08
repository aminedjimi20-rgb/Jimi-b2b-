import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { updateRuntimeProject, deleteRuntimeProject, type AdminProjectInput } from "@/lib/projectsStore";
import { sanitizeUrl } from "@/lib/sanitize";
import type { ProjectStatus } from "@/lib/types";

const VALID_STATUSES: ProjectStatus[] = ["draft", "published"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Partial<AdminProjectInput> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if ("videoUrl" in body) body.videoUrl = sanitizeUrl(body.videoUrl);
  if ("videoThumbnail" in body) body.videoThumbnail = sanitizeUrl(body.videoThumbnail);
  if ("videoTitle" in body) {
    body.videoTitle = body.videoTitle ? String(body.videoTitle).slice(0, 200) : null;
  }
  if ("status" in body && !VALID_STATUSES.includes(body.status as ProjectStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const project = await updateRuntimeProject(id, body);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, project });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await deleteRuntimeProject(id);
  return NextResponse.json({ ok: true });
}
