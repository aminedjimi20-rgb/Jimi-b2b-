import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createTestConversation, getConversationById, saveConversation } from "@/lib/conversationsStore";
import { runAgentTurn } from "@/lib/ai/agent";

/** Endpoint réservé à l'admin : fait tourner l'agent IA sur une conversation
 *  de test (channel "test", jamais envoyée sur WhatsApp), pour valider son
 *  comportement avant de le connecter à la Cloud API. */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    conversationId?: string;
    message?: string;
    imageUrl?: string;
  } | null;

  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "missing_message" }, { status: 400 });
  }

  const conversation = body?.conversationId
    ? await getConversationById(body.conversationId)
    : await createTestConversation();

  if (!conversation || conversation.channel !== "test") {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }

  try {
    const { conversation: updated } = await runAgentTurn({
      conversation,
      userMessage: message.slice(0, 2000),
      imageUrls: body?.imageUrl ? [body.imageUrl.trim()] : undefined,
    });
    await saveConversation(updated);
    return NextResponse.json({ conversation: updated });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Erreur inconnue.";
    const isConfigError = messageText.includes("ANTHROPIC_API_KEY");
    return NextResponse.json({ error: messageText }, { status: isConfigError ? 503 : 500 });
  }
}
