import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { updateWantedListing, deleteWantedListing, type WantedCategory, type WantedStatus } from "@/lib/wantedListingsStore";

const VALID_CATEGORIES: WantedCategory[] = ["machine", "piece", "moule", "autre"];
const VALID_STATUSES: WantedStatus[] = ["draft", "published"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 200);
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 3000);
  if (typeof body.wilaya === "string") patch.wilaya = body.wilaya.trim().slice(0, 100) || undefined;
  if (VALID_CATEGORIES.includes(body.category as WantedCategory)) patch.category = body.category;
  if (VALID_STATUSES.includes(body.status as WantedStatus)) patch.status = body.status;

  const listing = await updateWantedListing(id, patch);
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, listing });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteWantedListing(id);
  return NextResponse.json({ ok: true });
}
