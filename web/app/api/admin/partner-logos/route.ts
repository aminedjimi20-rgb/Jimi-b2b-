import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getPartnerLogos, addPartnerLogo } from "@/lib/partnerLogosStore";
import { sanitizeUrl } from "@/lib/sanitize";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const logos = await getPartnerLogos();
  return NextResponse.json({ logos });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const logoUrl = typeof body?.logoUrl === "string" ? sanitizeUrl(body.logoUrl) : null;
  if (!name || !logoUrl) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const websiteUrl = typeof body?.websiteUrl === "string" ? sanitizeUrl(body.websiteUrl) : null;
  const logo = await addPartnerLogo({ name, logoUrl, websiteUrl: websiteUrl || undefined });
  return NextResponse.json({ ok: true, logo });
}
