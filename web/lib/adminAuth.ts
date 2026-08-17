import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "jimi_admin_session";

const DEFAULT_PASSWORD = "jimi-admin-2026";
const SECRET = process.env.ADMIN_SESSION_SECRET || "jimi-renovation-installation-secret";

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

export function usingDefaultPassword(): boolean {
  return !process.env.ADMIN_PASSWORD;
}

function computeToken(password: string): string {
  return createHmac("sha256", SECRET).update(password).digest("hex");
}

export function checkPassword(candidate: string): boolean {
  const expected = computeToken(getAdminPassword());
  const actual = computeToken(candidate);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function getSessionToken(): string {
  return computeToken(getAdminPassword());
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = getSessionToken();
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
