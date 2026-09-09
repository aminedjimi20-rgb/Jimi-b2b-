import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { appendMessage, getConversationById } from "@/lib/conversationsStore";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

/** Réponse manuelle d'un admin qui a pris la main sur une conversation
 *  (statut HUMAN_ACTIVE) — seul canal restant pour parler au client une fois
 *  son numéro migré sur l'API Cloud (l'appli WhatsApp classique ne reçoit
 *  plus ses messages). N'affecte jamais l'IA ni le webhook. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }

  const conversation = await getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (conversation.status !== "HUMAN_ACTIVE") {
    return NextResponse.json({ error: "not_human_active" }, { status: 409 });
  }
  if (!conversation.customerPhone) {
    return NextResponse.json({ error: "no_phone" }, { status: 409 });
  }

  try {
    await sendWhatsAppTextMessage(conversation.customerPhone, message);
  } catch (error) {
    console.error("Échec de l'envoi manuel WhatsApp :", error);
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  const updated = await appendMessage(id, { role: "assistant", content: message });
  return NextResponse.json({ conversation: updated });
}
