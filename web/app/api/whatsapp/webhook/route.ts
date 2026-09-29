import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
  isWhatsAppWebhookConfigured,
  getWhatsAppVerifyToken,
  getWhatsAppAppSecret,
} from "@/lib/whatsapp";
import { getOrCreateConversationByPhone, appendMessage } from "@/lib/conversationsStore";
import { notifyAdminIfNeeded } from "@/lib/adminAlerts";

/**
 * Webhook WhatsApp Business Platform (Meta Cloud API).
 *
 * La réponse automatique par IA a été retirée : ce endpoint n'enregistre
 * plus que les messages entrants (visibles dans l'admin) et alerte l'admin —
 * il ne répond jamais au client à la place d'un humain. Volontairement
 * INERTE tant que WHATSAPP_APP_SECRET / WHATSAPP_VERIFY_TOKEN / etc. ne sont
 * pas configurés (voir web/.env.example) : GET renvoie 503 à la vérification
 * Meta, POST renvoie 503 sans traiter le message.
 */

// ---- GET : handshake de vérification Meta -----------------------------

export async function GET(request: NextRequest) {
  if (!isWhatsAppWebhookConfigured()) {
    return NextResponse.json({ error: "whatsapp_not_configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === getWhatsAppVerifyToken() && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

// ---- POST : réception des messages -------------------------------------

interface WhatsAppWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          from?: string;
          type?: string;
          text?: { body?: string };
          image?: { id?: string; caption?: string };
        }[];
      };
    }[];
  }[];
}

function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf-8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(request: NextRequest) {
  if (!isWhatsAppWebhookConfigured()) {
    return NextResponse.json({ error: "whatsapp_not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature, getWhatsAppAppSecret())) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contactName = value?.contacts?.[0]?.profile?.name ?? null;

      for (const message of value?.messages ?? []) {
        const from = message.from;
        if (!from) continue;

        // Les photos WhatsApp (message.image.id) nécessitent un
        // téléchargement authentifié via le Graph API puis un ré-upload
        // vers Cloudinary pour obtenir une URL publique exploitable par
        // l'IA (vision) — pipeline à brancher ici une fois Meta configuré.
        // En attendant, on note l'intention sans URL.
        const isPhoto = message.type === "image";
        const text = message.text?.body ?? (isPhoto ? message.image?.caption || "[Photo envoyée]" : "");
        if (!text) continue;

        try {
          // La réponse automatique par IA est désactivée : ce numéro est
          // repassé en usage manuel (app WhatsApp Business classique). On se
          // contente d'enregistrer le message entrant, pour qu'il reste
          // visible dans l'admin, et d'alerter l'admin — jamais de réponse
          // auto envoyée au client.
          const conversation = await getOrCreateConversationByPhone(from, contactName);
          const isNewConversation = conversation.messages.length === 0;
          const previousStatus = conversation.status;
          const previousScore = conversation.score;

          const updated = await appendMessage(conversation.id, { role: "user", content: text });
          if (updated) {
            await notifyAdminIfNeeded({ conversation: updated, isNewConversation, previousStatus, previousScore });
          }
        } catch (error) {
          // On ne fait jamais échouer la requête webhook (Meta désactive un
          // webhook qui échoue trop souvent) : on journalise et on continue.
          console.error("Erreur de traitement d'un message WhatsApp entrant :", error);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
