import type { Conversation, ConversationMessage, QualificationData } from "@/lib/types";
import { buildKnowledgeBaseText } from "@/lib/ai/knowledgeBase";
import { getAiProvider } from "@/lib/ai/provider";
import { computeLeadScore } from "@/lib/leadScoring";

const CATEGORY_LABELS = [
  "buy_machine — achat ou recherche d'une machine spécifique",
  "sell_machine — un client veut vendre sa machine",
  "part_electronic — pièce électronique",
  "part_electrical — pièce électrique",
  "part_hydraulic — pièce hydraulique",
  "part_mechanical — pièce mécanique",
  "mold — moule",
  "maintenance — maintenance préventive",
  "repair — dépannage / panne",
  "renovation — rénovation de machine",
  "automation — automatisation industrielle",
  "commissioning — mise en service",
  "quote_request — demande de devis (sans catégorie plus précise identifiée)",
  "installation — installation",
  "after_sales — service après-vente",
  "other — autre demande, ou catégorie pas encore claire",
].join("\n");

function buildSystemPrompt(knowledgeBase: string): string {
  return `Tu es l'assistant commercial WhatsApp de JIMI Industrie, une entreprise
algérienne spécialisée dans les machines d'injection plastique d'occasion, les pièces
industrielles, les moules, la rénovation, l'automatisation industrielle et la maintenance.

STYLE ET LANGUE
- Détecte automatiquement la langue du client à chaque message : darija algérienne (souvent
  écrite en lettres latines/arabizi ou en arabe dialectal), arabe standard, français, ou anglais.
  Réponds TOUJOURS dans la même langue/registre que le client, même s'il mélange les langues —
  adapte-toi naturellement, comme le ferait un commercial algérien qui parle plusieurs langues.
- Ton commercial, chaleureux, simple, jamais robotique. Pas de blocs de texte : des messages
  courts, style WhatsApp. Tu peux utiliser un emoji occasionnel (👋📸✅) mais sans exagérer.
- Comprends les fautes d'orthographe, les messages courts, les abréviations.
- Pose UNE SEULE question à la fois. N'enchaîne jamais plusieurs questions dans le même message.
  Adapte la question suivante à ce que le client vient de répondre.
- Ne spamme jamais : si le client ne répond pas à une question, ne la repose pas en boucle.

CATÉGORIES DE BESOIN À IDENTIFIER (renseigne "category" dès que c'est raisonnablement clair) :
${CATEGORY_LABELS}

QUALIFICATION COMMERCIALE
Ton but n'est pas seulement de répondre : transforme progressivement la conversation en
opportunité commerciale qualifiée, en amenant naturellement le client à préciser (selon la
catégorie) : type de machine (machineType), produit à fabriquer (productToManufacture),
capacité/production souhaitée (desiredCapacity), budget approximatif (budget), neuf ou occasion
(condition), localisation (location), délai souhaité (timeline), téléphone si différent du
WhatsApp utilisé (phone) — ou pour une pièce : référence/nom (partReference), marque (partBrand),
modèle de machine (machineModel), quantité (quantity), urgence (urgent), localisation — ou pour
une intervention : type de panne (issueDescription), machine concernée (machineModel, partBrand),
localisation, disponibilité. Mets photosReceived à true si le client a envoyé une photo, et
quoteRequested à true s'il demande explicitement un devis.

Renseigne le champ "qualification" avec TOUS ces champs à chaque tour : pour un champ texte
utilise une chaîne vide "" si l'information n'est pas encore connue (jamais une valeur inventée),
pour condition utilise "non precise", pour un booléen utilise false. Reprends les valeurs déjà
connues des tours précédents (ne les remets jamais à "" par oubli), et ajoute les nouvelles.

PHOTOS
Encourage l'envoi d'une photo quand cela peut aider à identifier une pièce, une machine, une
panne, un composant ou un moule (ex. "Si tu peux, envoie-moi une photo 📸 et je vais essayer de
l'identifier."). Ne le demande que quand c'est pertinent, pas systématiquement.

RÈGLE ABSOLUE — NE JAMAIS INVENTER
Tu ne dois JAMAIS inventer un prix, une disponibilité, un délai, une référence, une
caractéristique technique ou toute information sur un produit. Utilise UNIQUEMENT les
informations listées dans la BASE DE CONNAISSANCES ci-dessous. Si l'information demandée n'y
figure pas, dis clairement et simplement que tu dois vérifier avec l'équipe JIMI et que quelqu'un
reviendra vers le client — ne devine jamais.

ESCALADE HUMAINE
Mets "humanHandoffRequested" à true si : le client est hostile, mécontent ou insiste pour parler
à un humain ; la demande sort clairement du périmètre de JIMI ; ou la situation nécessite un
jugement humain que tu ne peux pas donner. Dans ce cas, dis simplement au client qu'un membre de
l'équipe JIMI va le recontacter.

RÉSUMÉ
Renseigne "summary" à chaque tour : un résumé court (1 à 3 phrases) de la conversation et du
besoin du client, à usage interne pour l'équipe JIMI (pas visible par le client).

BASE DE CONNAISSANCES (seule source d'information factuelle autorisée) :
${knowledgeBase}`;
}

function toHistoryTurns(
  messages: ConversationMessage[]
): { role: "user" | "assistant"; content: string; imageUrls?: string[] }[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      imageUrls: m.mediaUrls,
    }));
}

/** Fusionne la qualification déjà connue avec celle renvoyée par l'IA à ce
 *  tour, sans jamais laisser une valeur "inconnue" (chaîne vide, false,
 *  null) écraser une valeur déjà connue — filet de sécurité si le modèle
 *  oublie de reprendre une information déjà obtenue. */
function mergeQualification(existing: QualificationData, incoming: QualificationData): QualificationData {
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== null && value !== undefined && value !== "" && value !== false) {
      merged[key] = value;
    }
  }
  return merged as QualificationData;
}

/** true si l'IA est autorisée à répondre automatiquement dans cette
 *  conversation — false si un admin a pris la main ou si elle est fermée. */
export function shouldAiRespond(conversation: Conversation): boolean {
  return conversation.status === "AI_ACTIVE";
}

/** Exécute un tour de conversation : envoie le nouveau message du client à
 *  l'IA avec tout l'historique + la base de connaissances, et retourne une
 *  copie mise à jour de la conversation (message client + réponse IA
 *  ajoutés, qualification/catégorie/langue/score/résumé/statut à jour).
 *  Ne persiste rien — c'est au code appelant (route webhook ou testeur
 *  admin) de sauvegarder le résultat via lib/conversationsStore.ts. */
export async function runAgentTurn(params: {
  conversation: Conversation;
  userMessage: string;
  imageUrls?: string[];
}): Promise<{ reply: string; conversation: Conversation }> {
  const { conversation, userMessage, imageUrls } = params;

  // Firestore rejette une valeur de champ explicitement `undefined` (à la
  // différence d'une clé absente) — n'inclure "mediaUrls" que s'il y a de
  // vraies URLs.
  const now = new Date().toISOString();
  const userTurn: ConversationMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: userMessage,
    createdAt: now,
    ...(imageUrls && imageUrls.length > 0 ? { mediaUrls: imageUrls } : {}),
  };

  const knowledgeBase = await buildKnowledgeBaseText();
  const systemPrompt = buildSystemPrompt(knowledgeBase);

  const provider = getAiProvider();
  const output = await provider.generateTurn({
    systemPrompt,
    history: [...toHistoryTurns(conversation.messages), { role: "user", content: userMessage, imageUrls }],
  });

  const assistantTurn: ConversationMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: output.reply,
    createdAt: new Date().toISOString(),
  };

  const mergedQualification = mergeQualification(conversation.qualification, output.qualification);
  const { score, reasons } = computeLeadScore(mergedQualification, output.category);

  const updatedConversation: Conversation = {
    ...conversation,
    messages: [...conversation.messages, userTurn, assistantTurn],
    language: output.language,
    category: output.category,
    qualification: mergedQualification,
    summary: output.summary,
    score,
    scoreReasons: reasons,
    status: output.humanHandoffRequested ? "HUMAN_REQUIRED" : conversation.status,
    updatedAt: new Date().toISOString(),
  };

  return { reply: output.reply, conversation: updatedConversation };
}
