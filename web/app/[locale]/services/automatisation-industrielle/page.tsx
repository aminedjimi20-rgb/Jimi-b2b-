import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ServiceDetailContent } from "@/components/ServiceDetailContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "servicePages.automation" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: { canonical: "/services/automatisation-industrielle" },
  };
}

export default async function AutomationServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("servicePages.automation");

  return (
    <>
      <PageHeader eyebrow="Services" title={t("title")} subtitle={t("subtitle")} />
      <ServiceDetailContent serviceKey="automation" />
    </>
  );
}
