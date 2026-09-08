import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getServiceVideos, setServiceVideo, type ServiceVideoKey } from "@/lib/serviceVideos";
import { sanitizeUrl } from "@/lib/sanitize";

const VALID_KEYS: ServiceVideoKey[] = ["renovation", "automation", "maintenance"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const serviceVideos = await getServiceVideos();
  return NextResponse.json({ serviceVideos });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    key?: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
    videoTitle?: string | null;
    videoThumbnail?: string | null;
  } | null;

  if (!body?.key || !VALID_KEYS.includes(body.key as ServiceVideoKey)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }

  const videoUrl = sanitizeUrl(body.videoUrl);
  await setServiceVideo(body.key as ServiceVideoKey, {
    imageUrl: sanitizeUrl(body.imageUrl),
    videoUrl,
    videoTitle: videoUrl && body.videoTitle ? String(body.videoTitle).slice(0, 200) : null,
    videoThumbnail: videoUrl ? sanitizeUrl(body.videoThumbnail) : null,
  });
  return NextResponse.json({ ok: true });
}
