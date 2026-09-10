import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FaqAccordion } from "@/components/FaqAccordion";
import { JsonLd } from "@/components/JsonLd";

export async function FaqSection() {
  const t = await getTranslations("home.faq");
  const tItems = await getTranslations();
  const items = tItems.raw("faqItems") as { q: string; a: string }[];

  return (
    <section id="faq" className="py-20 md:py-28">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      <Container>
        <SectionHeading eyebrow="FAQ" title={t("title")} subtitle={t("subtitle")} />
        <div className="mx-auto mt-10 max-w-3xl">
          <FaqAccordion items={items} />
        </div>
      </Container>
    </section>
  );
}
