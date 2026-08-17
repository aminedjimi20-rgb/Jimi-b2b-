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
