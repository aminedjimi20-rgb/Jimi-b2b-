import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getMachines } from "@/lib/data";
import { addRuntimeMachine, type AdminMachineInput } from "@/lib/machinesStore";
import { sanitizeUrl, sanitizeStringList } from "@/lib/sanitize";
import { notifyNewProduct } from "@/lib/pushNotifications";
import type { MachineCondition } from "@/lib/types";

const VALID_CONDITIONS: MachineCondition[] = ["neuf", "occasion", "renove"];

function sanitizeSpecs(value: unknown): AdminMachineInput["specs"] {
  if (!value || typeof value !== "object") return {};
  const allowedKeys = [
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
  const specs: AdminMachineInput["specs"] = {};
  for (const key of allowedKeys) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw === "string" && raw.trim()) {
      specs[key] = raw.trim().slice(0, 200);
    }
  }
  return specs;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const machines = await getMachines();
  return NextResponse.json({ machines });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Partial<AdminMachineInput> | null;
  if (!body?.brand || !body.model || !body.tonnage || !body.year) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const machine = await addRuntimeMachine({
    brand: String(body.brand).slice(0, 100),
    model: String(body.model).slice(0, 100),
    reference: body.reference ? String(body.reference).slice(0, 100) : undefined,
    year: Number(body.year),
    tonnage: Number(body.tonnage),
    drive: body.drive ?? "hydraulique",
    condition: VALID_CONDITIONS.includes(body.condition as MachineCondition)
      ? (body.condition as MachineCondition)
      : "occasion",
    status: body.status ?? "published",
    wilaya: body.wilaya ?? "Alger",
    price: body.price ? Number(body.price) : null,
    priceOnRequest: Boolean(body.priceOnRequest),
    description: body.description ? String(body.description).slice(0, 3000) : "",
    specs: sanitizeSpecs(body.specs),
    worksPerformed: sanitizeStringList(body.worksPerformed),
    defects: sanitizeStringList(body.defects),
    accessories: sanitizeStringList(body.accessories),
    videoUrl: sanitizeUrl(body.videoUrl),
    videoThumbnail: sanitizeUrl(body.videoThumbnail),
    videoTitle: body.videoTitle ? String(body.videoTitle).slice(0, 200) : null,
    photos: Array.isArray(body.photos)
      ? body.photos.map((p) => sanitizeUrl(p)).filter((p): p is string => Boolean(p)).slice(0, 10)
      : [],
  });

  if (machine.status === "published") {
    await notifyNewProduct({ name: `${machine.brand} ${machine.model}`, url: `/machines/${machine.slug}` });
  }

  return NextResponse.json({ ok: true, machine });
}
