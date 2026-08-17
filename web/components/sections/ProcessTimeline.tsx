import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

export async function ProcessTimeline() {
  const t = await getTranslations("home.process");
  const steps = t.raw("steps") as { number: string; title: string; desc: string }[];

  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="Méthode" title={t("title")} subtitle={t("subtitle")} />

        <div className="relative mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
          <div className="absolute top-6 hidden h-px w-full bg-[var(--color-border)] lg:block" />
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--color-accent)] bg-white text-sm font-extrabold text-[var(--color-accent)]">
                {step.number}
              </div>
              <h3 className="mt-4 text-base font-bold text-[var(--color-ink)]">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-muted)]">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
