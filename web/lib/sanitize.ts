/** N'accepte que des URLs http(s) — évite d'enregistrer des schémas dangereux (javascript:, data:, ...). */
export function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Normalise une liste saisie en texte libre (un élément par ligne, via un
 *  <textarea> admin) en tableau de chaînes propres : lignes vides retirées,
 *  chaque élément et le nombre total plafonnés pour éviter un payload
 *  démesuré. Accepte aussi directement un tableau (ex: relu depuis l'API). */
export function sanitizeStringList(value: unknown, maxItems = 30, maxItemLength = 300): string[] {
  const raw = typeof value === "string" ? value.split("\n") : Array.isArray(value) ? value : [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim().slice(0, maxItemLength) : ""))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}
