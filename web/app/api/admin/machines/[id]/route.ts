import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { updateRuntimeMachine, deleteRuntimeMachine, type AdminMachineInput } from "@/lib/machinesStore";
import { sanitizeUrl, sanitizeStringList } from "@/lib/sanitize";
import { notifyNewProduct } from "@/lib/pushNotifications";
import { getMachines } from "@/lib/data";
import type { MachineStatus, MachineCondition } from "@/lib/types";

const VALID_STATUSES: MachineStatus[] = ["draft", "pending", "published", "rejected", "reserved", "sold"];
const VALID_CONDITIONS: MachineCondition[] = ["neuf", "occasion", "renove"];
const SPEC_KEYS = [
  "clampingForce",
  "screwDiameter",
  "injectionVolume",
  "injectionPressure",
  "motor",
  "control",
  "plc",
  "hmi",
  "pumpType",
  "hours",
] as const;

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
  if ("reference" in body) {
    body.reference = body.reference ? String(body.reference).slice(0, 100) : undefined;
  }
  if ("brand" in body && body.brand) body.brand = String(body.brand).slice(0, 100);
  if ("model" in body && body.model) body.model = String(body.model).slice(0, 100);
  if ("description" in body && body.description !== undefined) {
    body.description = String(body.description).slice(0, 3000);
  }
  if ("condition" in body) {
    if (!VALID_CONDITIONS.includes(body.condition as MachineCondition)) {
      return NextResponse.json({ error: "invalid_condition" }, { status: 400 });
    }
  }
  if ("specs" in body && body.specs && typeof body.specs === "object") {
    const clean: AdminMachineInput["specs"] = {};
    for (const key of SPEC_KEYS) {
      const raw = (body.specs as Record<string, unknown>)[key];
      if (typeof raw === "string" && raw.trim()) clean[key] = raw.trim().slice(0, 200);
    }
    body.specs = clean;
  }
  if ("worksPerformed" in body) body.worksPerformed = sanitizeStringList(body.worksPerformed);
  if ("defects" in body) body.defects = sanitizeStringList(body.defects);
  if ("accessories" in body) body.accessories = sanitizeStringList(body.accessories);

  let wasPublished = false;
  if ("status" in body) {
    if (!VALID_STATUSES.includes(body.status as MachineStatus)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    body.reviewedAt = new Date().toISOString();
    if (body.status === "published") {
      const existing = (await getMachines()).find((m) => m.id === id);
      wasPublished = existing?.status === "published";
    }
  }
  const machine = await updateRuntimeMachine(id, body);
  if (!machine) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (machine.status === "published" && !wasPublished) {
    await notifyNewProduct({ name: `${machine.brand} ${machine.model}`, url: `/machines/${machine.slug}` });
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
