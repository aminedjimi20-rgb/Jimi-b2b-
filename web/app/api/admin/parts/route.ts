import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getParts } from "@/lib/data";
import { addRuntimePart, type AdminPartInput } from "@/lib/partsStore";
import { sanitizeUrl } from "@/lib/sanitize";
import type { PartCategory, PartCondition, PartStatus } from "@/lib/types";

const VALID_CATEGORIES: PartCategory[] = ["electronique", "moules", "hydraulique", "mecanique"];
const VALID_CONDITIONS: PartCondition[] = ["neuf", "occasion", "renove"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parts = await getParts();
  return NextResponse.json({ parts });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Partial<AdminPartInput> | null;
  if (!body?.name || !body.reference || !body.category) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(body.category as PartCategory)) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }

  const part = await addRuntimePart({
    category: body.category as PartCategory,
    name: String(body.name).slice(0, 200),
    reference: String(body.reference).slice(0, 100),
    description: body.description ? String(body.description).slice(0, 2000) : "",
    condition: VALID_CONDITIONS.includes(body.condition as PartCondition)
      ? (body.condition as PartCondition)
      : "occasion",
    status: (body.status as PartStatus) === "draft" ? "draft" : "published",
    price: body.price ? Number(body.price) : null,
    priceOnRequest: Boolean(body.priceOnRequest),
    photos: Array.isArray(body.photos)
      ? body.photos.map((p) => sanitizeUrl(p)).filter((p): p is string => Boolean(p)).slice(0, 10)
      : [],
  });

  return NextResponse.json({ ok: true, part });
}
