import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-safe client used only to call storage.uploadToSignedUrl() — the
// signed URL + token (obtained from our own /api/upload/sign route) is what
// authorizes the upload, not this client. NEXT_PUBLIC_* values are meant to
// be public; no service-role key ever reaches the browser.
let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, { auth: { persistSession: false } });
  }
  return client;
}
