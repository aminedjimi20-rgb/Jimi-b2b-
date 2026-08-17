import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { MachinesExplorer } from "@/components/MachinesExplorer";
import { EmptyState } from "@/components/EmptyState";
import { getMachines, getMachineBrands } from "@/lib/data";
import { buildWhatsAppLink } from "@/config/site.config";
import { Factory } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "machines" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
    alternates: { canonical: "/machines" },
  };
}

export default async function MachinesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("machines");
  const tw = await getTranslations("whatsappMessages");
  const tc = await getTranslations("cta");
  const machines = await getMachines();
  const brands = await getMachineBrands();

  return (
    <>
      <PageHeader eyebrow="Machines" title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          {machines.length === 0 ? (
            <EmptyState
              icon={Factory}
              title={t("emptyCatalog.title")}
              subtitle={t("emptyCatalog.subtitle")}
              ctaHref="/acheter-machine"
              ctaLabel={tc("requestMachine")}
              whatsappHref={buildWhatsAppLink(tw("buyRequest"))}
              whatsappLabel={tc("whatsapp")}
            />
          ) : (
            <MachinesExplorer machines={machines} brands={brands} />
          )}
        </Container>
      </section>
    </>
  );
}
