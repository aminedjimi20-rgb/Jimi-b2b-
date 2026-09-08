import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getTestimonials } from "@/lib/data";
import { addRuntimeTestimonial, type AdminTestimonialInput } from "@/lib/testimonialsStore";
import type { TestimonialStatus } from "@/lib/types";

const VALID_STATUSES: TestimonialStatus[] = ["pending", "published", "rejected"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const testimonials = await getTestimonials();
  return NextResponse.json({ testimonials });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Partial<AdminTestimonialInput> | null;
  if (!body?.name || !body.message) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const ratingNum = Number(body.rating);
  const testimonial = await addRuntimeTestimonial({
    name: String(body.name).slice(0, 200),
    company: body.company ? String(body.company).slice(0, 200) : null,
    message: String(body.message).slice(0, 1000),
    rating: Number.isFinite(ratingNum) ? Math.min(5, Math.max(1, Math.round(ratingNum))) : 5,
    status: VALID_STATUSES.includes(body.status as TestimonialStatus)
      ? (body.status as TestimonialStatus)
      : "published",
  });

  return NextResponse.json({ ok: true, testimonial });
}
