import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { MachinesExplorer } from "@/components/MachinesExplorer";
import { getMachines, getMachineBrands } from "@/lib/data";
import { Info } from "lucide-react";

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
  const machines = await getMachines();
  const brands = await getMachineBrands();

  return (
    <>
      <PageHeader eyebrow="Machines" title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mb-6 flex items-start gap-2.5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Info size={16} className="mt-0.5 shrink-0" />
            <p>{t("demoBanner")}</p>
          </div>
          <MachinesExplorer machines={machines} brands={brands} />
        </Container>
      </section>
    </>
  );
}
