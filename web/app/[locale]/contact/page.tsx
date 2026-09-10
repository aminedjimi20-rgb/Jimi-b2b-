import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { ContactForm } from "@/components/forms/ContactForm";
import { ContactInfoPanel } from "@/components/ContactInfoPanel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contactPage" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: buildAlternates("/contact", locale),
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contactPage");

  return (
    <>
      <PageHeader eyebrow="Contact" title={t("title")} subtitle={t("subtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <ContactInfoPanel />
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm md:p-8 lg:col-span-3">
              <h2 className="mb-5 text-base font-bold text-[var(--color-ink)]">
                {t("formTitle")}
              </h2>
              <ContactForm />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
