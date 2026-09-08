import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { updateRuntimeTestimonial, deleteRuntimeTestimonial, type AdminTestimonialInput } from "@/lib/testimonialsStore";
import type { TestimonialStatus } from "@/lib/types";

const VALID_STATUSES: TestimonialStatus[] = ["pending", "published", "rejected"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Partial<AdminTestimonialInput> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if ("status" in body && !VALID_STATUSES.includes(body.status as TestimonialStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  if ("rating" in body) {
    const ratingNum = Number(body.rating);
    body.rating = Number.isFinite(ratingNum) ? Math.min(5, Math.max(1, Math.round(ratingNum))) : 5;
  }
  const testimonial = await updateRuntimeTestimonial(id, body);
  if (!testimonial) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, testimonial });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await deleteRuntimeTestimonial(id);
  return NextResponse.json({ ok: true });
}
