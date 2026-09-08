import { getPublicMachines, getPublicParts } from "@/lib/data";
import { getBusinessInfo } from "@/lib/businessInfoStore";
import type { PartCategory } from "@/lib/types";

// Caps how many catalogue items are serialized into the prompt — keeps
// token cost bounded even if the catalogue grows large. The AI is told the
// list may be partial and to say so rather than claim exhaustiveness.
const MAX_MACHINES = 40;
const MAX_PARTS_PER_CATEGORY = 20;

const PART_CATEGORY_LABELS: Record<PartCategory, string> = {
  electronique: "Pièces électroniques",
  moules: "Moules",
  hydraulique: "Pièces hydrauliques",
  mecanique: "Pièces mécaniques",
};

function formatPrice(price: number | null, priceOnRequest: boolean): string {
  if (priceOnRequest || price == null) return "prix sur demande";
  return `${price.toLocaleString("fr-FR")} DA`;
}

/** Construit un résumé texte compact du catalogue + des informations
 *  commerciales, destiné à être injecté dans le prompt système de l'IA.
 *  C'est la SEULE source d'information factuelle autorisée pour l'IA — elle
 *  ne doit jamais répondre à partir d'autre chose que ce texte. */
export async function buildKnowledgeBaseText(): Promise<string> {
  const [machines, parts, businessInfo] = await Promise.all([
    getPublicMachines(),
    getPublicParts(),
    getBusinessInfo(),
  ]);

  const sections: string[] = [];

  // --- Machines ---
  const availableMachines = machines.filter((m) => m.status === "published").slice(0, MAX_MACHINES);
  if (availableMachines.length > 0) {
    sections.push(
      "MACHINES DISPONIBLES (catalogue actuel — liste possiblement partielle) :\n" +
        availableMachines
          .map(
            (m) =>
              `- ${m.brand} ${m.model}, ${m.tonnage}T, année ${m.year}, entraînement ${m.drive}, wilaya ${m.wilaya}, ${formatPrice(m.price, m.priceOnRequest)}`
          )
          .join("\n")
    );
  } else {
    sections.push("MACHINES DISPONIBLES : aucune machine publiée actuellement dans le catalogue.");
  }

  // --- Parts / Moules by category ---
  const categories = Object.keys(PART_CATEGORY_LABELS) as PartCategory[];
  for (const category of categories) {
    const items = parts.filter((p) => p.category === category).slice(0, MAX_PARTS_PER_CATEGORY);
    if (items.length === 0) continue;
    sections.push(
      `${PART_CATEGORY_LABELS[category].toUpperCase()} DISPONIBLES :\n` +
        items
          .map(
            (p) =>
              `- ${p.name} (réf. ${p.reference}), état ${p.condition}, ${formatPrice(p.price, p.priceOnRequest)}`
          )
          .join("\n")
    );
  }

  // --- Business info ---
  if (businessInfo.services.length > 0) {
    sections.push("SERVICES PROPOSÉS :\n" + businessInfo.services.map((s) => `- ${s}`).join("\n"));
  }
  if (businessInfo.brands.length > 0) {
    sections.push("MARQUES CONNUES (machines/pièces) :\n" + businessInfo.brands.join(", "));
  }
  if (businessInfo.interventionZones.length > 0) {
    sections.push("ZONES D'INTERVENTION :\n" + businessInfo.interventionZones.join(", "));
  }
  if (businessInfo.conditions.trim()) {
    sections.push("CONDITIONS COMMERCIALES :\n" + businessInfo.conditions.trim());
  }
  if (businessInfo.faq.length > 0) {
    sections.push(
      "QUESTIONS FRÉQUENTES :\n" +
        businessInfo.faq.map((f) => `Q: ${f.question}\nR: ${f.answer}`).join("\n\n")
    );
  }
  if (businessInfo.notes.trim()) {
    sections.push("NOTES COMMERCIALES INTERNES :\n" + businessInfo.notes.trim());
  }

  if (sections.length === 0) {
    return "Aucune information n'est actuellement disponible dans la base de connaissances.";
  }

  return sections.join("\n\n");
}
