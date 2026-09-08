import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { TestimonialForm } from "@/components/forms/TestimonialForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "testimonialForm" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
    alternates: { canonical: "/avis" },
  };
}

export default async function AvisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("testimonialForm");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mx-auto max-w-xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm md:p-9">
            <TestimonialForm />
          </div>
        </Container>
      </section>
    </>
  );
}
