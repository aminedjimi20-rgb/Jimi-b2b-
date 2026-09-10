import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BuyEquipmentForm } from "@/components/forms/BuyEquipmentForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "acheterHub" });
  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates: buildAlternates("/acheter", locale),
  };
}

const VALID_TYPES = ["machine", "piece", "moule", "equipement"] as const;
type BuyType = (typeof VALID_TYPES)[number];

function isValidType(value: string | undefined): value is BuyType {
  return VALID_TYPES.includes(value as BuyType);
}

export default async function AcheterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { locale } = await params;
  const { type } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("acheterHub");
  const tn = await getTranslations("nav");

  return (
    <>
      <Breadcrumbs
        locale={locale}
        items={[{ label: tn("home"), href: "/" }, { label: tn("acheter") }]}
      />
      <PageHeader eyebrow={t("eyebrow")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm md:p-9">
            <BuyEquipmentForm initialType={isValidType(type) ? type : null} />
          </div>
        </Container>
      </section>
    </>
  );
}
