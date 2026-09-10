import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/pushStore";
import { sanitizeUrl } from "@/lib/sanitize";
import { isRateLimited } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`push-unsubscribe:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  const endpoint = sanitizeUrl(body?.endpoint);
  if (!endpoint) {
    return NextResponse.json({ error: "invalid_endpoint" }, { status: 400 });
  }

  await unsubscribe(endpoint);
  return NextResponse.json({ ok: true });
}
