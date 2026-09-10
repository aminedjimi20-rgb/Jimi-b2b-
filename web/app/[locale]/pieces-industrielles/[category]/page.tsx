import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { PartsGrid } from "@/components/PartsGrid";
import { getPublicPartsByCategory } from "@/lib/data";
import { buildWhatsAppLink } from "@/config/site.config";
import type { PartCategory } from "@/lib/types";
import { Cog } from "lucide-react";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: PartCategory[] = [
  "electrique",
  "electronique",
  "hydraulique",
  "mecanique",
  "automatisme",
  "plc-hmi",
  "variateurs",
  "servo-moteurs",
  "moules",
];

function isValidCategory(value: string): value is PartCategory {
  return (VALID_CATEGORIES as string[]).includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  if (!isValidCategory(category)) return {};
  const t = await getTranslations({ locale, namespace: "pieces" });
  return {
    title: t(`categories.${category}.seoTitle`),
    description: t(`categories.${category}.seoDescription`),
    alternates: { canonical: `/pieces-industrielles/${category}` },
  };
}

export default async function PieceCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale, category } = await params;
  if (!isValidCategory(category)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("pieces");
  const tw = await getTranslations("whatsappMessages");
  const tc = await getTranslations("cta");
  const parts = await getPublicPartsByCategory(category);

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t(`categories.${category}.title`)}
        subtitle={t(`categories.${category}.description`)}
      />
      <section className="py-12 md:py-16">
        <Container>
          {parts.length === 0 ? (
            <EmptyState
              icon={Cog}
              title={t("emptyCategory.title")}
              subtitle={t("emptyCategory.subtitle")}
              whatsappHref={buildWhatsAppLink(tw("generalContact"))}
              whatsappLabel={tc("whatsapp")}
            />
          ) : (
            <PartsGrid parts={parts} />
          )}
        </Container>
      </section>
    </>
  );
}
