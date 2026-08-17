import { NextRequest, NextResponse } from "next/server";
import { submitMachineForReview, type SellerListingInput } from "@/lib/machinesStore";
import { findOrCreateSeller } from "@/lib/sellers";
import { notifyAdminNewListing } from "@/lib/notifications";
import { isRateLimited } from "@/lib/rateLimit";
import { sanitizeUrl } from "@/lib/sanitize";
import type { MachineDrive } from "@/lib/types";

const MAX_TEXT = 2000;
const MAX_PHOTOS = 10;
const VALID_DRIVES: MachineDrive[] = ["hydraulique", "servo", "hybride"];

function cleanPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => sanitizeUrl(v))
    .filter((v): v is string => Boolean(v))
    .slice(0, MAX_PHOTOS);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`listings:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Honeypot field: real users never fill this hidden input.
  if (b.website) {
    return NextResponse.json({ ok: true });
  }

  const brand = typeof b.brand === "string" ? b.brand.trim().slice(0, 200) : "";
  const model = typeof b.model === "string" ? b.model.trim().slice(0, 200) : "";
  const tonnage = Number(b.tonnage);
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 200) : "";
  const phone = typeof b.phone === "string" ? b.phone.trim().slice(0, 50) : "";

  if (!brand || !model || !Number.isFinite(tonnage) || tonnage <= 0 || !name || !phone) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const yearNum = Number(b.year);
  const priceNum = Number(b.priceWanted);
  const drive = VALID_DRIVES.includes(b.drive as MachineDrive) ? (b.drive as MachineDrive) : "hydraulique";
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim().slice(0, 200) : null;
  const whatsapp = typeof b.whatsapp === "string" && b.whatsapp.trim() ? b.whatsapp.trim().slice(0, 50) : null;
  const company = typeof b.company === "string" && b.company.trim() ? b.company.trim().slice(0, 200) : null;
  const sellerWilaya = typeof b.wilaya === "string" ? b.wilaya.trim().slice(0, 100) : null;

  const STATE_LABELS: Record<string, string> = {
    excellent: "État : excellent",
    good: "État : bon",
    average: "État : moyen",
    toRenovate: "État : à rénover",
  };
  let description = typeof b.description === "string" ? b.description.trim() : "";
  if (typeof b.state === "string" && STATE_LABELS[b.state]) {
    description = `${STATE_LABELS[b.state]}\n${description}`;
  }
  if (typeof b.availability === "string" && b.availability.trim()) {
    description = `${description}\nDisponibilité : ${b.availability.trim()}`;
  }

  const seller = await findOrCreateSeller({
    name,
    phone,
    whatsapp,
    email,
    wilaya: sellerWilaya,
    company,
  });

  const input: SellerListingInput = {
    brand,
    model,
    tonnage,
    year: Number.isFinite(yearNum) && yearNum > 0 ? yearNum : null,
    drive,
    wilaya: sellerWilaya ?? "",
    price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null,
    priceOnRequest: Boolean(b.priceOnRequest) || !Number.isFinite(priceNum) || priceNum <= 0,
    description: description.trim().slice(0, MAX_TEXT),
    videoUrl: sanitizeUrl(b.video),
    photos: cleanPhotos(b.photos),
    sellerId: seller.id,
  };

  const machine = await submitMachineForReview(input);
  await notifyAdminNewListing(machine);

  return NextResponse.json({ ok: true, id: machine.id });
}
