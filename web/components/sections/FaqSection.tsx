import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FaqAccordion } from "@/components/FaqAccordion";

export async function FaqSection() {
  const t = await getTranslations("home.faq");
  const tItems = await getTranslations();
  const items = tItems.raw("faqItems") as { q: string; a: string }[];

  return (
    <section id="faq" className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="FAQ" title={t("title")} subtitle={t("subtitle")} />
        <div className="mx-auto mt-10 max-w-3xl">
          <FaqAccordion items={items} />
        </div>
      </Container>
    </section>
  );
}
