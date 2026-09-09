import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getConversationById, updateConversation } from "@/lib/conversationsStore";
import type { ConversationStatus } from "@/lib/types";

const VALID_STATUSES: ConversationStatus[] = ["AI_ACTIVE", "HUMAN_REQUIRED", "HUMAN_ACTIVE", "CLOSED"];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const conversation = await getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (!body || !VALID_STATUSES.includes(body.status as ConversationStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const conversation = await updateConversation(id, { status: body.status as ConversationStatus });
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}
