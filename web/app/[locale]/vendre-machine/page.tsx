import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { SellerForm } from "@/components/forms/SellerForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sellPage" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: buildAlternates("/vendre-machine", locale),
  };
}

export default async function SellMachinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sellPage");

  return (
    <>
      <PageHeader eyebrow="Machines" title={t("title")} subtitle={t("intro")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm md:p-9">
            <SellerForm />
          </div>
        </Container>
      </section>
    </>
  );
}
