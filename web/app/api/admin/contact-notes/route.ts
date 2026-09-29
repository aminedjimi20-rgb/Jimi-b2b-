import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getContactNotes, addContactNote, type ContactNoteType } from "@/lib/contactNotesStore";

const VALID_TYPES: ContactNoteType[] = ["client", "prospect", "autre"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const notes = await getContactNotes();
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const type = VALID_TYPES.includes(body?.type as ContactNoteType) ? (body!.type as ContactNoteType) : "prospect";
  const note = await addContactNote({
    name,
    phone: typeof body?.phone === "string" ? body.phone.trim().slice(0, 50) : undefined,
    type,
    wilaya: typeof body?.wilaya === "string" ? body.wilaya.trim().slice(0, 100) : undefined,
    notes: typeof body?.notes === "string" ? body.notes.trim().slice(0, 5000) : "",
  });
  return NextResponse.json({ ok: true, note });
}
