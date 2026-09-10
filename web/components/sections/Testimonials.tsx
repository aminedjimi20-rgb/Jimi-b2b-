import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { JsonLd } from "@/components/JsonLd";
import { getPublicTestimonials } from "@/lib/data";
import { siteConfig } from "@/config/site.config";
import { Quote, Star } from "lucide-react";

export async function Testimonials() {
  const t = await getTranslations("home.testimonials");
  const testimonials = await getPublicTestimonials();
  // Uniquement des avis réellement soumis et publiés (voir /avis) — jamais
  // de note ou d'avis inventé. Le schema n'apparaît donc qu'une fois qu'au
  // moins un vrai avis existe, et reflète tous les avis publiés (pas
  // seulement les 6 affichés ci-dessous).
  const averageRating =
    testimonials.length > 0
      ? testimonials.reduce((sum, item) => sum + item.rating, 0) / testimonials.length
      : 0;

  return (
    <section className="bg-[var(--color-surface-2)] py-20 md:py-28">
      {testimonials.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": `${siteConfig.seo.siteUrl}/#organization`,
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Number(averageRating.toFixed(1)),
              reviewCount: testimonials.length,
              bestRating: 5,
              worstRating: 1,
            },
            review: testimonials.map((item) => ({
              "@type": "Review",
              author: { "@type": "Person", name: item.name },
              reviewRating: {
                "@type": "Rating",
                ratingValue: item.rating,
                bestRating: 5,
                worstRating: 1,
              },
              reviewBody: item.message,
            })),
          }}
        />
      )}
      <Container>
        <SectionHeading eyebrow="Clients" title={t("title")} subtitle={t("subtitle")} />

        {testimonials.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xl rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center">
            <Quote size={28} className="mx-auto text-[var(--color-accent)]/40" />
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t("emptyState")}
            </p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.slice(0, 6).map((testimonial) => (
              <figure
                key={testimonial.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white p-6"
              >
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      size={15}
                      className={
                        value <= testimonial.rating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-transparent text-slate-300"
                      }
                    />
                  ))}
                </div>
                <blockquote className="flex-1 text-sm leading-relaxed text-[var(--color-text)]">
                  {testimonial.message}
                </blockquote>
                <figcaption className="text-sm font-bold text-[var(--color-ink)]">
                  {testimonial.name}
                  {testimonial.company && (
                    <span className="font-normal text-[var(--color-text-muted)]"> — {testimonial.company}</span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button href="/avis" variant="outline">
            {t("cta")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
