import { NextRequest, NextResponse } from "next/server";
import { submitTestimonialForReview, type PublicTestimonialInput } from "@/lib/testimonialsStore";
import { isRateLimited } from "@/lib/rateLimit";

const MAX_TEXT = 1000;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(`testimonials:${ip}`, 10)) {
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

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 200) : "";
  const message = typeof b.message === "string" ? b.message.trim().slice(0, MAX_TEXT) : "";
  const company = typeof b.company === "string" && b.company.trim() ? b.company.trim().slice(0, 200) : null;
  const ratingNum = Number(b.rating);
  const rating = Number.isFinite(ratingNum) ? Math.min(5, Math.max(1, Math.round(ratingNum))) : 5;

  if (!name || !message) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const input: PublicTestimonialInput = { name, company, message, rating };
  const testimonial = await submitTestimonialForReview(input);

  return NextResponse.json({ ok: true, id: testimonial.id });
}
