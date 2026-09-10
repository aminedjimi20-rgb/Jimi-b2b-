/**
 * Envoi de notifications Web Push (protocole standard, via VAPID) aux
 * navigateurs abonnés. Volontairement inerte tant que les variables
 * d'environnement ne sont pas configurées — voir web/.env.example.
 */
import webpush from "web-push";
import type { PushSubscriber } from "@/lib/pushStore";

function getConfig() {
  return {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "mailto:aminedjimi20@gmail.com",
  };
}

export function isPushConfigured(): boolean {
  const { publicKey, privateKey } = getConfig();
  return Boolean(publicKey && privateKey);
}

let vapidSet = false;
function ensureVapidConfigured() {
  if (vapidSet) return;
  const { publicKey, privateKey, subject } = getConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidSet = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export type PushSendResult = "sent" | "gone" | "error";

/** Envoie une notification à un abonné. Retourne "gone" si l'abonnement
 *  n'est plus valide côté navigateur (désinstallé, permission révoquée...)
 *  — l'appelant doit alors désabonner ce subscriber. */
export async function sendPushToSubscriber(
  subscriber: Pick<PushSubscriber, "endpoint" | "keys">,
  payload: PushPayload
): Promise<PushSendResult> {
  if (!isPushConfigured()) return "error";
  ensureVapidConfigured();

  try {
    await webpush.sendNotification(
      { endpoint: subscriber.endpoint, keys: subscriber.keys },
      JSON.stringify(payload)
    );
    return "sent";
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) return "gone";
    console.error("Échec d'envoi Web Push :", error);
    return "error";
  }
}
