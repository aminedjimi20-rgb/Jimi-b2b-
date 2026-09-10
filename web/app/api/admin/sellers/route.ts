import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getSellers, findOrCreateSeller } from "@/lib/sellers";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sellers = await getSellers();
  return NextResponse.json({ sellers });
}

/** Enregistre (ou retrouve, par téléphone) un vendeur — utilisé quand
 *  l'admin accepte une demande "Vente équipement" depuis l'onglet Demandes,
 *  pour que le contact atterrisse dans l'onglet Vendeurs au lieu de rester
 *  perdu dans le texte brut de la demande. */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 50) : "";
  if (!name || !phone) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const seller = await findOrCreateSeller({
    name,
    phone,
    whatsapp: typeof body?.whatsapp === "string" && body.whatsapp.trim() ? body.whatsapp.trim().slice(0, 50) : null,
    wilaya: typeof body?.wilaya === "string" && body.wilaya.trim() ? body.wilaya.trim().slice(0, 100) : null,
    company: null,
    email: null,
  });
  return NextResponse.json({ ok: true, seller });
}
