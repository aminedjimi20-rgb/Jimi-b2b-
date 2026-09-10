import type { PublicMachine } from "@/lib/data";
import type { Part } from "@/lib/types";

/** Lowercase + strip diacritics so "électrique" matches "electrique" and
 *  vice versa — French/Arabic-transliterated brand and part names are
 *  typed inconsistently by real users. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  if (!query) return false;
  return fields.some((field) => field && normalizeSearch(field).includes(query));
}

export function searchMachines(machines: PublicMachine[], rawQuery: string): PublicMachine[] {
  const query = normalizeSearch(rawQuery);
  if (!query) return [];
  return machines.filter((m) =>
    matches(query, m.brand, m.model, m.reference, m.description, m.wilaya)
  );
}

export function searchParts(parts: Part[], rawQuery: string): Part[] {
  const query = normalizeSearch(rawQuery);
  if (!query) return [];
  return parts.filter((p) =>
    matches(query, p.name, p.brand, p.model, p.reference, p.description, p.compatibility, p.wilaya)
  );
}
