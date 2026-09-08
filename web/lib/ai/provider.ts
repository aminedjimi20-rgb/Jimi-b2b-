import type { AgentTurnOutput } from "@/lib/ai/schema";
import { AnthropicProvider } from "@/lib/ai/anthropicProvider";

export interface AgentHistoryTurn {
  role: "user" | "assistant";
  content: string;
  /** URLs publiques (Cloudinary) de photos jointes par le client — seulement
   *  pertinent pour role "user". */
  imageUrls?: string[];
}

/** Un fournisseur IA transforme un prompt système + un historique de
 *  conversation en une sortie structurée (réponse + extraction). Toute la
 *  logique métier (prompt, base de connaissances, scoring) vit en dehors de
 *  cette interface — changer de fournisseur (autre modèle, autre API) ne
 *  touche que le fichier qui l'implémente. */
export interface AiProvider {
  generateTurn(params: { systemPrompt: string; history: AgentHistoryTurn[] }): Promise<AgentTurnOutput>;
}

let cachedProvider: AiProvider | null = null;

/** Sélectionne le fournisseur IA via AI_PROVIDER (défaut : "anthropic").
 *  Prévu pour être étendu avec d'autres fournisseurs sans changer
 *  lib/ai/agent.ts. */
export function getAiProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.AI_PROVIDER || "anthropic";
  switch (providerName) {
    case "anthropic":
      cachedProvider = new AnthropicProvider();
      return cachedProvider;
    default:
      throw new Error(`Fournisseur IA inconnu : "${providerName}". Seul "anthropic" est supporté actuellement.`);
  }
}
