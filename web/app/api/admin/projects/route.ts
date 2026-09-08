import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getProjects } from "@/lib/data";
import { addRuntimeProject, type AdminProjectInput } from "@/lib/projectsStore";
import { sanitizeUrl } from "@/lib/sanitize";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const projects = await getProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Partial<AdminProjectInput> | null;
  if (!body?.title || !body.brand || !body.tonnage || !body.problem || !body.solution || !body.result) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const project = await addRuntimeProject({
    title: String(body.title).slice(0, 200),
    brand: String(body.brand).slice(0, 100),
    tonnage: Number(body.tonnage),
    problem: String(body.problem).slice(0, 2000),
    solution: String(body.solution).slice(0, 2000),
    result: String(body.result).slice(0, 2000),
    status: body.status === "draft" ? "draft" : "published",
    videoUrl: sanitizeUrl(body.videoUrl),
    videoThumbnail: sanitizeUrl(body.videoThumbnail),
    videoTitle: body.videoTitle ? String(body.videoTitle).slice(0, 200) : null,
    photos: Array.isArray(body.photos)
      ? body.photos.map((p) => sanitizeUrl(p)).filter((p): p is string => Boolean(p)).slice(0, 10)
      : [],
  });

  return NextResponse.json({ ok: true, project });
}
