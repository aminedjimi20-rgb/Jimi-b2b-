import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ContactForm } from "@/components/forms/ContactForm";
import { ContactInfoPanel } from "@/components/ContactInfoPanel";

export async function ContactSection() {
  const t = await getTranslations("contactPage");

  return (
    <section id="contact" className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="Contact" title={t("title")} subtitle={t("subtitle")} />

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ContactInfoPanel />
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm lg:col-span-3">
            <ContactForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
