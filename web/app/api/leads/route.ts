import { NextRequest, NextResponse } from "next/server";
import { addLead, type LeadType } from "@/lib/leads";
import { isRateLimited } from "@/lib/rateLimit";

const VALID_TYPES: LeadType[] = ["buy", "sell", "service", "contact"];
const MAX_FIELD_LENGTH = 2000;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`leads:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { type, data, website } = body as {
    type?: string;
    data?: Record<string, unknown>;
    website?: string;
  };

  // Honeypot field: real users never fill this hidden input.
  if (website) {
    return NextResponse.json({ ok: true });
  }

  if (!type || !VALID_TYPES.includes(type as LeadType)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const cleanData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string") continue;
    cleanData[key.slice(0, 100)] = value.slice(0, MAX_FIELD_LENGTH);
  }

  if (!cleanData.name && !cleanData.phone && !cleanData.email) {
    return NextResponse.json({ error: "missing_contact_info" }, { status: 400 });
  }

  const lead = await addLead(type as LeadType, cleanData);
  return NextResponse.json({ ok: true, id: lead.id });
}
