import type { Machine } from "@/lib/types";

/**
 * Fires when a new machine listing is submitted for review. Today this is a
 * no-op beyond logging: the admin dashboard's "Annonces à valider" tab badge
 * already surfaces pending listings in real time, which is the notification
 * channel that works without any extra credentials.
 *
 * Extension points for later (wire up once credentials/infra exist):
 * - Email: send via a transactional provider (e.g. Resend, Postmark) to
 *   `siteConfig.contact.email`, triggered by an env var such as RESEND_API_KEY.
 * - WhatsApp: send via the WhatsApp Business Cloud API to
 *   `siteConfig.contact.whatsappNumber`.
 * Call sites (the submission API route) never need to change — only this
 * function's body does, once a channel is actually wired up.
 */
export async function notifyAdminNewListing(machine: Machine): Promise<void> {
  console.log(`[listings] New pending listing: ${machine.brand} ${machine.model} (${machine.id})`);
}
