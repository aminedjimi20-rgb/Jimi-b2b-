import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getHomeVideo, setHomeVideo } from "@/lib/homeVideoStore";
import { sanitizeUrl } from "@/lib/sanitize";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const homeVideo = await getHomeVideo();
  return NextResponse.json({ homeVideo });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    videoUrl?: string | null;
    videoTitle?: string | null;
  } | null;

  const videoUrl = sanitizeUrl(body?.videoUrl);
  await setHomeVideo({
    videoUrl,
    videoTitle: videoUrl && body?.videoTitle ? String(body.videoTitle).slice(0, 200) : null,
  });
  return NextResponse.json({ ok: true });
}
