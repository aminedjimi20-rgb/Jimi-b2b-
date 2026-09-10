import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { BuyerRequestForm } from "@/components/forms/BuyerRequestForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "buyPage" });
  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates: buildAlternates("/acheter-machine", locale),
  };
}

export default async function BuyMachinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("buyPage");

  return (
    <>
      <PageHeader eyebrow="Machines" title={t("title")} subtitle={t("subtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm md:p-9">
            <BuyerRequestForm />
          </div>
        </Container>
      </section>
    </>
  );
}
