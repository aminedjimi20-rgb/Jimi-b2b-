import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import type { Conversation, ConversationStatus, LeadScoreLevel } from "@/lib/types";

function getAdminAlertPhone(): string | null {
  const phone = process.env.ADMIN_ALERT_PHONE?.trim();
  return phone || null;
}

/** Alerte WhatsApp envoyée à l'admin (numéro personnel, distinct du numéro
 *  business) quand une conversation mérite son attention alors qu'il n'est
 *  pas en train de regarder le dashboard : nouvelle conversation, lead qui
 *  devient HOT, ou passage en HUMAN_REQUIRED. Best-effort — une alerte
 *  manquée ne doit jamais faire échouer le traitement du message client. */
export async function notifyAdminIfNeeded(params: {
  conversation: Conversation;
  isNewConversation: boolean;
  previousStatus: ConversationStatus;
  previousScore: LeadScoreLevel;
}): Promise<void> {
  const adminPhone = getAdminAlertPhone();
  if (!adminPhone) return;

  const { conversation, isNewConversation, previousStatus, previousScore } = params;
  const becameHumanRequired = conversation.status === "HUMAN_REQUIRED" && previousStatus !== "HUMAN_REQUIRED";
  const becameHot = conversation.score === "HOT" && previousScore !== "HOT";

  if (!isNewConversation && !becameHumanRequired && !becameHot) return;

  const reason = becameHumanRequired
    ? "⚠️ Intervention humaine requise"
    : becameHot
      ? "🔥 Lead HOT"
      : "💬 Nouvelle conversation";
  const who = conversation.customerName || conversation.customerPhone || "Client";
  const lastMessage = conversation.messages[conversation.messages.length - 1]?.content ?? "";

  const text = `${reason}\n${who}\n"${lastMessage}"\n\nVoir le dashboard : /admin/dashboard`;

  try {
    await sendWhatsAppTextMessage(adminPhone, text);
  } catch (error) {
    console.error("Échec de l'alerte admin WhatsApp :", error);
  }
}
