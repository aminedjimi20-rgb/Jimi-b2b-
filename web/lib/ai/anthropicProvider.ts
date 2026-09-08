import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AgentTurnSchema, type AgentTurnOutput } from "@/lib/ai/schema";
import type { AiProvider, AgentHistoryTurn } from "@/lib/ai/provider";

// Sonnet 5 plutôt qu'Opus 5 : ce endpoint tourne dans une fonction Vercel
// avec un délai d'exécution limité (plan Hobby) — Sonnet répond assez vite
// pour rester dans cette limite pour une conversation WhatsApp en temps réel.
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;

function toAnthropicMessages(history: AgentHistoryTurn[]): Anthropic.MessageParam[] {
  return history.map((turn) => {
    if (turn.role === "user" && turn.imageUrls && turn.imageUrls.length > 0) {
      const content: Anthropic.ContentBlockParam[] = [
        ...turn.imageUrls.map(
          (url): Anthropic.ImageBlockParam => ({
            type: "image",
            source: { type: "url", url },
          })
        ),
        { type: "text", text: turn.content },
      ];
      return { role: "user", content };
    }
    return { role: turn.role, content: turn.content };
  });
}

export class AnthropicProvider implements AiProvider {
  private client: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY manquante — ajoutez-la dans .env.local (ou les variables d'environnement Vercel) pour activer l'assistant IA."
      );
    }
    this.client = new Anthropic();
  }

  async generateTurn({
    systemPrompt,
    history,
  }: {
    systemPrompt: string;
    history: AgentHistoryTurn[];
  }): Promise<AgentTurnOutput> {
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: zodOutputFormat(AgentTurnSchema) },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: toAnthropicMessages(history),
    });

    if (!response.parsed_output) {
      throw new Error("La réponse de l'IA n'a pas pu être analysée (parsed_output vide).");
    }
    return response.parsed_output;
  }
}
