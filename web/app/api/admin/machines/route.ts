import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getMachines } from "@/lib/data";
import { addRuntimeMachine, type AdminMachineInput } from "@/lib/machinesStore";
import { sanitizeUrl } from "@/lib/sanitize";

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
    brand: String(body.brand),
    model: String(body.model),
    year: Number(body.year),
    tonnage: Number(body.tonnage),
    drive: body.drive ?? "hydraulique",
    status: body.status ?? "published",
    wilaya: body.wilaya ?? "Alger",
    price: body.price ? Number(body.price) : null,
    priceOnRequest: Boolean(body.priceOnRequest),
    description: body.description ?? "",
    videoUrl: sanitizeUrl(body.videoUrl),
    videoThumbnail: sanitizeUrl(body.videoThumbnail),
    videoTitle: body.videoTitle ? String(body.videoTitle).slice(0, 200) : null,
    photos: Array.isArray(body.photos)
      ? body.photos.map((p) => sanitizeUrl(p)).filter((p): p is string => Boolean(p)).slice(0, 10)
      : [],
  });

  return NextResponse.json({ ok: true, machine });
}
