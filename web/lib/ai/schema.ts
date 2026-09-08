import { z } from "zod";
import { DETECTED_LANGUAGES, LEAD_CATEGORIES } from "@/lib/types";

/** Schéma de sortie structurée du tour de conversation IA.
 *
 * IMPORTANT — pas de `.describe()` à l'intérieur de `QualificationSchema` (ni
 * sur l'objet, ni sur ses champs) : Anthropic convertit chaque schéma
 * annoté d'une description en `$ref` vers `$defs`, et le faire sur les 16
 * champs de qualification a fait dépasser la limite de complexité de
 * l'API ("Schema is too complex", 400). Les descriptions au niveau
 * `AgentTurnSchema` (champs scalaires, non imbriqués) restent sans risque.
 * Le sens de chaque champ de qualification est expliqué dans le prompt
 * système (lib/ai/agent.ts) plutôt que dans le schéma.
 *
 * Convention "valeur inconnue" (pour rester compatible avec la règle
 * "NE PAS INVENTER") : chaîne vide `""` pour les champs texte, `false` pour
 * les booléens tant que le client n'a rien confirmé — jamais de valeur
 * plausible mais non dite par le client. */
export const QualificationSchema = z.object({
  machineType: z.string(),
  productToManufacture: z.string(),
  desiredCapacity: z.string(),
  budget: z.string(),
  condition: z.enum(["neuf", "occasion", "non precise"]),
  partReference: z.string(),
  partBrand: z.string(),
  machineModel: z.string(),
  quantity: z.string(),
  issueDescription: z.string(),
  location: z.string(),
  timeline: z.string(),
  phone: z.string(),
  urgent: z.boolean(),
  photosReceived: z.boolean(),
  quoteRequested: z.boolean(),
});

export const AgentTurnSchema = z.object({
  reply: z
    .string()
    .describe(
      "Le message à envoyer au client : dans sa langue, ton commercial WhatsApp naturel et chaleureux (jamais robotique), une seule question à la fois, jamais de prix/délai/référence inventés."
    ),
  language: z.enum(DETECTED_LANGUAGES).describe("Langue détectée du dernier message du client."),
  category: z
    .enum(LEAD_CATEGORIES)
    .describe("Catégorie de besoin détectée à partir de toute la conversation ; 'other' si pas encore clair."),
  qualification: QualificationSchema,
  humanHandoffRequested: z
    .boolean()
    .describe(
      "true si un humain doit reprendre la main : client hostile/mécontent, demande explicite de parler à quelqu'un, ou situation hors du périmètre de l'assistant."
    ),
  summary: z
    .string()
    .describe("Résumé court (1 à 3 phrases) de la conversation et du besoin du client, à usage interne pour l'équipe JIMI."),
});

export type AgentTurnOutput = z.infer<typeof AgentTurnSchema>;
