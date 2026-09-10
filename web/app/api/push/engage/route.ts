import { NextRequest, NextResponse } from "next/server";
import { markEngaged } from "@/lib/pushStore";
import { sanitizeUrl } from "@/lib/sanitize";
import { isRateLimited } from "@/lib/rateLimit";

/** Appelé après la soumission réussie d'un lead / d'un intérêt machine /
 *  d'une proposition de vente : ce visiteur est déjà en contact avec
 *  l'admin, on arrête les notifications automatiques (nouveaux produits,
 *  rappels d'inactivité) pour lui. Best-effort — jamais bloquant. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`push-engage:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  const endpoint = sanitizeUrl(body?.endpoint);
  if (!endpoint) {
    return NextResponse.json({ error: "invalid_endpoint" }, { status: 400 });
  }

  await markEngaged(endpoint);
  return NextResponse.json({ ok: true });
}
