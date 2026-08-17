import { getSupabaseAdmin } from "@/lib/supabase";

export const MACHINE_MEDIA_BUCKET = "machine-media";

let bucketReady = false;

/** Creates the public storage bucket for machine photos/videos on first use,
 *  so the user doesn't need a manual dashboard step for this part of setup
 *  (tables still need supabase/schema.sql run once — that part can't be
 *  automated, Supabase has no safe "run arbitrary DDL" API call). */
export async function ensureMachineMediaBucket(): Promise<void> {
  if (bucketReady) return;
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.storage.getBucket(MACHINE_MEDIA_BUCKET);
  if (!existing) {
    const { error } = await supabase.storage.createBucket(MACHINE_MEDIA_BUCKET, {
      public: true,
      fileSizeLimit: "100MB",
    });
    // Ignore a race where another request created it first.
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

export function getPublicMediaUrl(path: string): string {
  const { data } = getSupabaseAdmin().storage.from(MACHINE_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
