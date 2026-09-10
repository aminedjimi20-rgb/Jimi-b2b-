import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ServiceDetailContent } from "@/components/ServiceDetailContent";
import { siteConfig } from "@/config/site.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "servicePages.maintenance" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: buildAlternates("/services/maintenance-depannage", locale),
  };
}

export default async function MaintenanceServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("servicePages.maintenance");
  const tn = await getTranslations("nav");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: t("title"),
          description: t("subtitle"),
          provider: { "@type": "Organization", name: siteConfig.companyName },
          areaServed: "DZ",
        }}
      />
      <Breadcrumbs
        locale={locale}
        items={[
          { label: tn("home"), href: "/" },
          { label: tn("services"), href: "/services" },
          { label: t("title") },
        ]}
      />
      <PageHeader eyebrow="Services" title={t("title")} subtitle={t("subtitle")} />
      <ServiceDetailContent serviceKey="maintenance" />
    </>
  );
}
