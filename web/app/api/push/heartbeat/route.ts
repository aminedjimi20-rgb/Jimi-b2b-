import { NextRequest, NextResponse } from "next/server";
import { touchLastSeen } from "@/lib/pushStore";
import { sanitizeUrl } from "@/lib/sanitize";
import { isRateLimited } from "@/lib/rateLimit";

const VALID_LOCALES = ["fr", "ar", "en"];

/** Appelé (au plus une fois par heure, throttlé côté client) tant qu'un
 *  visiteur abonné est présent sur le site — réinitialise le décompte
 *  "dernière visite" utilisé par le rappel d'inactivité. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`push-heartbeat:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { endpoint?: string; locale?: string } | null;
  const endpoint = sanitizeUrl(body?.endpoint);
  const locale = VALID_LOCALES.includes(body?.locale ?? "") ? (body!.locale as string) : "fr";
  if (!endpoint) {
    return NextResponse.json({ error: "invalid_endpoint" }, { status: 400 });
  }

  await touchLastSeen(endpoint, locale);
  return NextResponse.json({ ok: true });
}
