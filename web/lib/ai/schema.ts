import { z } from "zod";
import { DETECTED_LANGUAGES, LEAD_CATEGORIES } from "@/lib/types";

/** Schéma de sortie structurée du tour de conversation IA. Chaque champ de
 *  qualification est nullable/optionnel : le modèle ne doit renseigner que
 *  ce que le client a réellement dit, jamais inventer une valeur — voir la
 *  règle "NE PAS INVENTER" dans le prompt système (lib/ai/agent.ts). */
export const QualificationSchema = z.object({
  machineType: z
    .string()
    .nullable()
    .optional()
    .describe("Type de machine recherchée/vendue (ex. 'presse à injection'). null si non mentionné."),
  productToManufacture: z
    .string()
    .nullable()
    .optional()
    .describe("Produit que le client veut fabriquer avec la machine."),
  desiredCapacity: z
    .string()
    .nullable()
    .optional()
    .describe("Capacité/production souhaitée, ex. '1000 bouteilles/heure'."),
  budget: z.string().nullable().optional().describe("Budget approximatif mentionné par le client, tel quel."),
  condition: z
    .enum(["neuf", "occasion"])
    .nullable()
    .optional()
    .describe("Préférence neuf/occasion si exprimée."),
  partReference: z.string().nullable().optional().describe("Référence ou nom de la pièce recherchée."),
  partBrand: z.string().nullable().optional().describe("Marque de la pièce ou de la machine concernée."),
  machineModel: z
    .string()
    .nullable()
    .optional()
    .describe("Modèle de la machine concernée (pièce ou intervention)."),
  quantity: z.string().nullable().optional().describe("Quantité demandée."),
  issueDescription: z
    .string()
    .nullable()
    .optional()
    .describe("Description de la panne/du problème pour une demande d'intervention."),
  location: z.string().nullable().optional().describe("Localisation du client (wilaya/ville)."),
  timeline: z.string().nullable().optional().describe("Délai souhaité par le client."),
  phone: z
    .string()
    .nullable()
    .optional()
    .describe("Numéro de téléphone si donné explicitement et différent du numéro WhatsApp utilisé."),
  urgent: z.boolean().nullable().optional().describe("true si le client indique une urgence."),
  photosReceived: z
    .boolean()
    .optional()
    .describe("true si le client a envoyé au moins une photo dans cette conversation."),
  quoteRequested: z.boolean().optional().describe("true si le client demande explicitement un devis."),
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
    .nullable()
    .describe("Catégorie de besoin détectée à partir de toute la conversation, null si pas encore clair."),
  qualification: QualificationSchema.describe(
    "Informations de qualification à jour, reprises de TOUTE la conversation (garder les valeurs déjà connues, ajouter les nouvelles, ne jamais effacer une valeur connue sauf contradiction explicite du client)."
  ),
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
