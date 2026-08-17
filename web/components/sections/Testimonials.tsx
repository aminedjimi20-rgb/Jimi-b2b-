import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Quote } from "lucide-react";

export async function Testimonials() {
  const t = await getTranslations("home.testimonials");

  return (
    <section className="bg-[var(--color-surface-2)] py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="Clients" title={t("title")} subtitle={t("subtitle")} />

        <div className="mx-auto mt-10 max-w-xl rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center">
          <Quote size={28} className="mx-auto text-[var(--color-accent)]/40" />
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
            {t("emptyState")}
          </p>
        </div>
      </Container>
    </section>
  );
}
