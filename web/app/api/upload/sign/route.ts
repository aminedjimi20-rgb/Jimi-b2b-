import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { ensureMachineMediaBucket, getPublicMediaUrl, MACHINE_MEDIA_BUCKET } from "@/lib/supabaseStorage";
import { isRateLimited } from "@/lib/rateLimit";

const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  // One form (several photos + a video) legitimately needs many calls here.
  if (isRateLimited(`upload-sign:${ip}`, 60)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "storage_not_configured", message: "Le stockage des photos/vidéos n'est pas encore configuré." },
      { status: 501 }
    );
  }

  const body = (await request.json().catch(() => null)) as { contentType?: string; kind?: string } | null;
  if (!body?.contentType || (body.kind !== "photo" && body.kind !== "video")) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const extensions = body.kind === "photo" ? PHOTO_TYPES : VIDEO_TYPES;
  const ext = extensions[body.contentType];
  if (!ext) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  }

  await ensureMachineMediaBucket();

  const path = `${body.kind}s/${randomUUID()}.${ext}`;
  const { data, error } = await getSupabaseAdmin().storage.from(MACHINE_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    path,
    publicUrl: getPublicMediaUrl(path),
  });
}
