import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getBusinessInfo, setBusinessInfo, type BusinessInfo, type FaqEntry } from "@/lib/businessInfoStore";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const businessInfo = await getBusinessInfo();
  return NextResponse.json({ businessInfo });
}

function toStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim().slice(0, 200))
    .slice(0, maxItems);
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Partial<BusinessInfo> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const faq: FaqEntry[] = Array.isArray(body.faq)
    ? body.faq
        .filter(
          (f): f is FaqEntry =>
            Boolean(f) && typeof f.question === "string" && typeof f.answer === "string" && f.question.trim() !== ""
        )
        .map((f) => ({ question: f.question.trim().slice(0, 300), answer: f.answer.trim().slice(0, 1000) }))
        .slice(0, 50)
    : [];

  const businessInfo: BusinessInfo = {
    brands: toStringArray(body.brands, 100),
    services: toStringArray(body.services, 50),
    interventionZones: toStringArray(body.interventionZones, 100),
    conditions: typeof body.conditions === "string" ? body.conditions.trim().slice(0, 3000) : "",
    notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 3000) : "",
    faq,
  };

  await setBusinessInfo(businessInfo);
  return NextResponse.json({ ok: true });
}
