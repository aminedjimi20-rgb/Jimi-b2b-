/**
 * Intégration WhatsApp Business Platform (Cloud API — Meta officiel).
 * Volontairement inerte tant que les variables d'environnement ne sont pas
 * configurées : `isWhatsAppConfigured()` doit être vérifié avant tout appel,
 * et `sendWhatsAppTextMessage` lève une erreur explicite sinon. Rien ici ne
 * simule WhatsApp — c'est la vraie API Meta, prête à être activée en
 * renseignant les variables ci-dessous (voir web/.env.example).
 */

const GRAPH_API_VERSION = "v21.0";

function getConfig() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  };
}

/** true si les identifiants nécessaires pour ENVOYER des messages sont présents. */
export function isWhatsAppConfigured(): boolean {
  const { phoneNumberId, accessToken } = getConfig();
  return Boolean(phoneNumberId && accessToken);
}

/** true si les identifiants nécessaires pour RECEVOIR (webhook) sont présents. */
export function isWhatsAppWebhookConfigured(): boolean {
  const { appSecret, verifyToken } = getConfig();
  return Boolean(appSecret && verifyToken) && isWhatsAppConfigured();
}

export function getWhatsAppVerifyToken(): string {
  return getConfig().verifyToken;
}

export function getWhatsAppAppSecret(): string {
  return getConfig().appSecret;
}

/** Envoie un message texte via la Cloud API. À utiliser uniquement dans le
 *  webhook (réponse de l'IA) — jamais côté client. */
export async function sendWhatsAppTextMessage(to: string, body: string): Promise<void> {
  const { phoneNumberId, accessToken } = getConfig();
  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "WhatsApp Cloud API non configurée (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN manquants)."
    );
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Échec de l'envoi WhatsApp (${res.status}) : ${errorBody}`);
  }
}
