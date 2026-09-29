import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { updateContactNote, deleteContactNote, type ContactNoteType } from "@/lib/contactNotesStore";

const VALID_TYPES: ContactNoteType[] = ["client", "prospect", "autre"];

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
  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 200);
  if (typeof body.phone === "string") patch.phone = body.phone.trim().slice(0, 50) || undefined;
  if (typeof body.wilaya === "string") patch.wilaya = body.wilaya.trim().slice(0, 100) || undefined;
  if (typeof body.notes === "string") patch.notes = body.notes.trim().slice(0, 5000);
  if (VALID_TYPES.includes(body.type as ContactNoteType)) patch.type = body.type;

  const note = await updateContactNote(id, patch);
  if (!note) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, note });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteContactNote(id);
  return NextResponse.json({ ok: true });
}
