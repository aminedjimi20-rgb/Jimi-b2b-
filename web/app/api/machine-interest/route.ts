import { NextRequest, NextResponse } from "next/server";
import { getMachines } from "@/lib/data";
import { findOrCreateBuyer } from "@/lib/buyers";
import { addMachineLead } from "@/lib/machineLeads";
import { notifyAdminNewInterest } from "@/lib/notifications";
import { isRateLimited } from "@/lib/rateLimit";

const MAX_TEXT = 2000;

function isPublic(status: string): boolean {
  return status === "published" || status === "reserved" || status === "sold";
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`interest:${ip}`)) {
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

  const machineId = typeof b.machineId === "string" ? b.machineId : "";
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 200) : "";
  const phone = typeof b.phone === "string" ? b.phone.trim().slice(0, 50) : "";

  if (!machineId || !name || !phone) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Only machines actually public can receive interest — this also
  // prevents probing for hidden/draft/pending/rejected machine IDs.
  const machines = await getMachines();
  const machine = machines.find((m) => m.id === machineId);
  if (!machine || !isPublic(machine.status)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const company = typeof b.company === "string" && b.company.trim() ? b.company.trim().slice(0, 200) : null;
  const whatsapp = typeof b.whatsapp === "string" && b.whatsapp.trim() ? b.whatsapp.trim().slice(0, 50) : null;
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim().slice(0, 200) : null;
  const wilaya = typeof b.wilaya === "string" && b.wilaya.trim() ? b.wilaya.trim().slice(0, 100) : null;
  const message = typeof b.message === "string" ? b.message.trim().slice(0, MAX_TEXT) : "";

  const buyer = await findOrCreateBuyer({ name, company, phone, whatsapp, email, wilaya });

  const lead = await addMachineLead({
    machineId: machine.id,
    machineSlug: machine.slug,
    machineLabel: `${machine.brand} ${machine.model} — ${machine.tonnage}T`,
    sellerId: machine.sellerId ?? null,
    buyerId: buyer.id,
    message,
  });

  await notifyAdminNewInterest(machine);

  return NextResponse.json({ ok: true, id: lead.id });
}
