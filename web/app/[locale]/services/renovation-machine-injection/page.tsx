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
  const t = await getTranslations({ locale, namespace: "servicePages.renovation" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: { canonical: "/services/renovation-machine-injection" },
  };
}

export default async function RenovationServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("servicePages.renovation");

  return (
    <>
      <PageHeader eyebrow="Services" title={t("title")} subtitle={t("subtitle")} />
      <ServiceDetailContent serviceKey="renovation" />
    </>
  );
}
