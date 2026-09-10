import { NextRequest, NextResponse } from "next/server";
import { sendInactivityReminders } from "@/lib/pushNotifications";

/** Déclenché quotidiennement par Vercel Cron (voir vercel.json). Protégé
 *  par CRON_SECRET : Vercel envoie automatiquement
 *  `Authorization: Bearer $CRON_SECRET` pour les cron jobs du projet. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await sendInactivityReminders();
  return NextResponse.json({ ok: true, ...result });
}
