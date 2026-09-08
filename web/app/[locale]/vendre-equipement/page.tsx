import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { SellEquipmentForm } from "@/components/forms/SellEquipmentForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sellEquipment" });
  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates: { canonical: "/vendre-equipement" },
  };
}

const VALID_TYPES = ["machine", "piece", "moule"] as const;
type EquipmentType = (typeof VALID_TYPES)[number];

function isValidType(value: string | undefined): value is EquipmentType {
  return VALID_TYPES.includes(value as EquipmentType);
}

export default async function SellEquipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { locale } = await params;
  const { type } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("sellEquipment");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm md:p-9">
            <SellEquipmentForm initialType={isValidType(type) ? type : null} />
          </div>
        </Container>
      </section>
    </>
  );
}
