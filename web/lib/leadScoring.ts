import type { LeadCategory, LeadScoreLevel, QualificationData } from "@/lib/types";

/**
 * Scoring de lead HOT / WARM / COLD — système de points simple et
 * explicite, pensé pour être ajustable sans toucher au reste du code :
 * modifiez les constantes ci-dessous (poids des critères, seuils) selon
 * l'expérience terrain.
 *
 * Logique : chaque signal commercial connu (budget, localisation, délai,
 * besoin précisé, demande de devis explicite, contact direct, photo
 * envoyée...) ajoute des points. Plus le client a donné d'informations
 * concrètes, plus l'opportunité est chaude.
 */

const POINTS = {
  hasCategory: 1, // un besoin identifié (catégorie autre que "other"/null)
  hasBudget: 2,
  hasLocation: 2,
  hasTimeline: 2,
  isUrgent: 1, // bonus si le client indique explicitement une urgence
  hasQuoteRequest: 2, // demande de devis explicite
  hasSpecificNeed: 1, // machine/produit/pièce/panne précisé
  hasPhone: 1, // coordonnée directe laissée
  hasPhotos: 1, // engagement : a envoyé une photo
} as const;

// Seuils sur le total de points ci-dessus.
const HOT_THRESHOLD = 6;
const WARM_THRESHOLD = 3;

function hasSpecificNeed(q: QualificationData): boolean {
  return Boolean(
    q.machineType || q.productToManufacture || q.partReference || q.machineModel || q.issueDescription
  );
}

export function computeLeadScore(
  qualification: QualificationData,
  category: LeadCategory | null
): { score: LeadScoreLevel; reasons: string[] } {
  let points = 0;
  const reasons: string[] = [];

  if (category && category !== "other") {
    points += POINTS.hasCategory;
    reasons.push("Besoin identifié");
  }
  if (qualification.budget) {
    points += POINTS.hasBudget;
    reasons.push("Budget indiqué");
  }
  if (qualification.location) {
    points += POINTS.hasLocation;
    reasons.push("Localisation connue");
  }
  if (qualification.timeline) {
    points += POINTS.hasTimeline;
    reasons.push("Délai indiqué");
  }
  if (qualification.urgent) {
    points += POINTS.isUrgent;
    reasons.push("Demande urgente");
  }
  if (qualification.quoteRequested) {
    points += POINTS.hasQuoteRequest;
    reasons.push("Devis demandé");
  }
  if (hasSpecificNeed(qualification)) {
    points += POINTS.hasSpecificNeed;
    reasons.push("Besoin précis (machine/pièce/panne)");
  }
  if (qualification.phone) {
    points += POINTS.hasPhone;
    reasons.push("Numéro de contact laissé");
  }
  if (qualification.photosReceived) {
    points += POINTS.hasPhotos;
    reasons.push("Photo envoyée");
  }

  let score: LeadScoreLevel = "COLD";
  if (points >= HOT_THRESHOLD) score = "HOT";
  else if (points >= WARM_THRESHOLD) score = "WARM";

  return { score, reasons };
}
