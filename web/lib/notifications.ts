import type { Machine } from "@/lib/types";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { getAdminAlertPhone } from "@/lib/adminAlerts";

/** Alerte WhatsApp best-effort vers le numéro personnel de l'admin
 *  (ADMIN_ALERT_PHONE) — une alerte manquée ne doit jamais faire échouer la
 *  soumission du client. No-op si ADMIN_ALERT_PHONE n'est pas configuré. */
async function sendAdminAlert(text: string): Promise<void> {
  const adminPhone = getAdminAlertPhone();
  if (!adminPhone) return;
  try {
    await sendWhatsAppTextMessage(adminPhone, text);
  } catch (error) {
    console.error("Échec de l'alerte admin WhatsApp :", error);
  }
}

/** Fires when a new machine listing is submitted for review. The admin
 *  dashboard's "Annonces à valider" tab already surfaces it in real time;
 *  this adds a WhatsApp ping for when the admin isn't looking at the
 *  dashboard. */
export async function notifyAdminNewListing(machine: Machine): Promise<void> {
  console.log(`[listings] New pending listing: ${machine.brand} ${machine.model} (${machine.id})`);
  await sendAdminAlert(
    `🆕 Nouvelle annonce à valider\n${machine.brand} ${machine.model} (${machine.tonnage} T)\n\nVoir : /admin/dashboard`
  );
}

/** Fires when a buyer expresses interest in a published machine. */
export async function notifyAdminNewInterest(machine: Machine): Promise<void> {
  console.log(`[leads] New buyer interest: ${machine.brand} ${machine.model} (${machine.id})`);
  await sendAdminAlert(
    `🙋 Nouveau lead acheteur\nIntéressé par : ${machine.brand} ${machine.model}\n\nVoir : /admin/dashboard`
  );
}

/** Fires when someone submits a "sell" lead (pièce, moule, ou autre
 *  équipement) via le formulaire "Vendre un équipement". */
export async function notifyAdminNewSellRequest(equipmentType: string, from: string): Promise<void> {
  await sendAdminAlert(
    `🆕 Nouvelle demande de vente (${equipmentType})\nDe : ${from}\n\nVoir : /admin/dashboard`
  );
}
