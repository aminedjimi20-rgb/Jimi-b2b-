import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getWantedListings, addWantedListing, type WantedCategory, type WantedStatus } from "@/lib/wantedListingsStore";

const VALID_CATEGORIES: WantedCategory[] = ["machine", "piece", "moule", "autre"];
const VALID_STATUSES: WantedStatus[] = ["draft", "published"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const listings = await getWantedListings();
  return NextResponse.json({ listings });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const category = VALID_CATEGORIES.includes(body?.category as WantedCategory)
    ? (body!.category as WantedCategory)
    : "autre";
  const status = VALID_STATUSES.includes(body?.status as WantedStatus) ? (body!.status as WantedStatus) : "draft";
  const listing = await addWantedListing({
    title,
    category,
    description: typeof body?.description === "string" ? body.description.trim().slice(0, 3000) : "",
    wilaya: typeof body?.wilaya === "string" ? body.wilaya.trim().slice(0, 100) : undefined,
    status,
  });
  return NextResponse.json({ ok: true, listing });
}
