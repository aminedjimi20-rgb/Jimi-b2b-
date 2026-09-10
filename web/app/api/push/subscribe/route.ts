import { NextRequest, NextResponse } from "next/server";
import { upsertSubscriber } from "@/lib/pushStore";
import { sanitizeUrl } from "@/lib/sanitize";
import { isRateLimited } from "@/lib/rateLimit";

const VALID_LOCALES = ["fr", "ar", "en"];

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`push-subscribe:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    locale?: string;
  } | null;

  const endpoint = sanitizeUrl(body?.endpoint);
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  const locale = VALID_LOCALES.includes(body?.locale ?? "") ? (body!.locale as string) : "fr";

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const subscriber = await upsertSubscriber({ endpoint, keys: { p256dh, auth }, locale });
  return NextResponse.json({ ok: true, id: subscriber.id });
}
