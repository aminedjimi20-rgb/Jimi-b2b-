import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client using the service_role key: full read/write access,
// bypassing Row Level Security entirely. Every table in supabase/schema.sql
// has RLS enabled with zero policies, so this key — kept out of the browser
// bundle by only ever being read in server-side code (API routes, Server
// Components) — is the ONLY way to reach seller/buyer private data. Never
// import this file from a "use client" component.
let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see web/supabase/schema.sql and web/.env.example)."
    );
  }
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}
