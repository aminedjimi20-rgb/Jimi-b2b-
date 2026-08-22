const WINDOW_MS = 60_000;
// Default budget per key per minute. Deliberately generous: this exists to
// block scripted flooding, not to interrupt a real person filling out a
// form — submitting several times in a row, or uploading several photos
// (each photo/video is its own request) from the same IP must never error.
const DEFAULT_MAX_REQUESTS = 30;

const hits = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests: number = DEFAULT_MAX_REQUESTS): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(key, timestamps);
  return timestamps.length > maxRequests;
}
