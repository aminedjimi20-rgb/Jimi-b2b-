import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { updateRuntimePart, deleteRuntimePart, type AdminPartInput } from "@/lib/partsStore";
import { sanitizeUrl } from "@/lib/sanitize";
import { notifyNewProduct } from "@/lib/pushNotifications";
import { getParts } from "@/lib/data";
import type { PartCategory, PartCondition, PartStatus } from "@/lib/types";

const VALID_CATEGORIES: PartCategory[] = [
  "electrique",
  "electronique",
  "hydraulique",
  "mecanique",
  "automatisme",
  "plc-hmi",
  "variateurs",
  "servo-moteurs",
  "moules",
  "autre",
];
const VALID_CONDITIONS: PartCondition[] = ["neuf", "occasion", "renove"];
const VALID_STATUSES: PartStatus[] = ["draft", "published"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Partial<AdminPartInput> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if ("category" in body && !VALID_CATEGORIES.includes(body.category as PartCategory)) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }
  if ("condition" in body && !VALID_CONDITIONS.includes(body.condition as PartCondition)) {
    return NextResponse.json({ error: "invalid_condition" }, { status: 400 });
  }
  if ("status" in body && !VALID_STATUSES.includes(body.status as PartStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  if ("photos" in body) {
    body.photos = Array.isArray(body.photos)
      ? body.photos.map((p) => sanitizeUrl(p)).filter((p): p is string => Boolean(p)).slice(0, 10)
      : [];
  }

  let wasPublished = false;
  if (body.status === "published") {
    const existing = (await getParts()).find((p) => p.id === id);
    wasPublished = existing?.status === "published";
  }

  const part = await updateRuntimePart(id, body);
  if (!part) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (part.status === "published" && !wasPublished) {
    await notifyNewProduct({ name: part.name, url: `/pieces-industrielles/${part.category}` });
  }

  return NextResponse.json({ ok: true, part });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await deleteRuntimePart(id);
  return NextResponse.json({ ok: true });
}
