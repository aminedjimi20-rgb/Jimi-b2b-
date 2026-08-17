import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MachineArt } from "@/components/MachineArt";
import { JsonLd } from "@/components/JsonLd";
import { getMachineBySlug } from "@/lib/data";
import { buildWhatsAppLink } from "@/config/site.config";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Gauge,
  MessageCircle,
  Mail,
  CalendarClock,
  Info,
} from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const machine = await getMachineBySlug(slug);
  if (!machine) return {};
  const t = await getTranslations({ locale, namespace: "machineDetail" });
  const title = `${machine.brand} ${machine.model} — ${machine.tonnage}T (${machine.year})`;
  const description = machine.description.slice(0, 155);

  return {
    title,
    description,
    alternates: { canonical: `/machines/${slug}` },
    openGraph: { title, description },
    other: { "machine-specs-title": t("specsTitle") },
  };
}

const statusTone: Record<string, "success" | "danger" | "warning" | "accent"> = {
  disponible: "success",
  vendue: "danger",
  reservee: "warning",
  nouveau: "accent",
};

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const machine = await getMachineBySlug(slug);
  if (!machine) notFound();

  const t = await getTranslations();
  const waInterest = buildWhatsAppLink(
    t("whatsappMessages.machineInterest", {
      brand: machine.brand,
      model: machine.model,
      tonnage: `${machine.tonnage}T`,
    })
  );

  const specRows: [string, string | undefined][] = [
    [t("machineDetail.specs.brand"), machine.brand],
    [t("machineDetail.specs.model"), machine.model],
    [t("machineDetail.specs.year"), String(machine.year)],
    [t("machineDetail.specs.tonnage"), `${machine.tonnage} T`],
    [t("machineDetail.specs.clampingForce"), machine.specs.clampingForce],
    [t("machineDetail.specs.screwDiameter"), machine.specs.screwDiameter],
    [t("machineDetail.specs.injectionVolume"), machine.specs.injectionVolume],
    [t("machineDetail.specs.injectionPressure"), machine.specs.injectionPressure],
    [t("machineDetail.specs.motor"), machine.specs.motor],
    [t("machineDetail.specs.control"), machine.specs.control],
    [t("machineDetail.specs.plc"), machine.specs.plc],
    [t("machineDetail.specs.hmi"), machine.specs.hmi],
    [t("machineDetail.specs.pumpType"), machine.specs.pumpType],
    [t("machineDetail.specs.condition"), machine.specs.condition],
    [t("machineDetail.specs.hours"), machine.specs.hours],
    [t("machineDetail.specs.location"), machine.wilaya],
    [
      t("machineDetail.specs.price"),
      machine.priceOnRequest || !machine.price
        ? t("machines.priceOnRequest")
        : `${machine.price.toLocaleString("fr-FR")} DA`,
    ],
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: `${machine.brand} ${machine.model}`,
          brand: machine.brand,
          description: machine.description,
          offers: {
            "@type": "Offer",
            priceCurrency: "DZD",
            price: machine.price ?? undefined,
            availability:
              machine.status === "disponible" || machine.status === "nouveau"
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
          },
        }}
      />

      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] py-4">
        <Container>
          <Link
            href="/machines"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          >
            <ArrowLeft size={15} className="rtl:rotate-180" />
            {t("cta.backToMachines")}
          </Link>
        </Container>
      </section>

      <section className="py-10 md:py-14">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone={statusTone[machine.status]}>{t(`badges.${machine.status}`)}</Badge>
                {machine.isDemo && <Badge tone="neutral">{t("demoDataBadge")}</Badge>}
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
                {machine.brand} {machine.model}
              </h1>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[var(--color-text-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <Gauge size={14} /> {machine.tonnage} T
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} /> {machine.year}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} /> {machine.wilaya}
                </span>
              </div>

              <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                {t("machineDetail.galleryTitle")}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: machine.images }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square overflow-hidden rounded-lg bg-[var(--color-ink)]"
                  >
                    <MachineArt seed={i} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>

              <h2 className="mt-10 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                {t("machineDetail.descriptionTitle")}
              </h2>
              <p className="text-sm leading-relaxed text-[var(--color-text)]">
                {machine.description}
              </p>

              {machine.worksPerformed.length > 0 && (
                <>
                  <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                    {t("machineDetail.worksTitle")}
                  </h2>
                  <ul className="space-y-2">
                    {machine.worksPerformed.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-2)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {machine.defects.length > 0 && (
                <>
                  <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                    {t("machineDetail.defectsTitle")}
                  </h2>
                  <ul className="space-y-2">
                    {machine.defects.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-warn)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {machine.accessories.length > 0 && (
                <>
                  <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                    {t("machineDetail.accessoriesTitle")}
                  </h2>
                  <ul className="space-y-2">
                    {machine.accessories.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="sticky top-24 flex flex-col gap-6">
                <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                  <h2 className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                    {t("machineDetail.specsTitle")}
                  </h2>
                  <dl className="divide-y divide-[var(--color-border)]">
                    {specRows
                      .filter(([, value]) => Boolean(value))
                      .map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                          <dt className="text-[var(--color-text-muted)]">{label}</dt>
                          <dd className="text-end font-medium text-[var(--color-ink)]">{value}</dd>
                        </div>
                      ))}
                  </dl>
                </div>

                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6">
                  <h2 className="text-base font-bold text-[var(--color-ink)]">
                    {t("machineDetail.interestedTitle")}
                  </h2>
                  <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
                    {t("machineDetail.interestedSubtitle")}
                  </p>
                  <div className="mt-5 flex flex-col gap-3">
                    <Button
                      href={waInterest}
                      external
                      variant="whatsapp"
                      icon={<MessageCircle size={17} />}
                    >
                      {t("cta.contactWhatsapp")}
                    </Button>
                    <Button href="/contact" variant="outline" icon={<Mail size={17} />}>
                      {t("cta.requestInfo")}
                    </Button>
                    <Button href="/contact" variant="ghost" icon={<CalendarClock size={17} />}>
                      {t("cta.scheduleInspection")}
                    </Button>
                  </div>
                </div>

                {machine.isDemo && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <p>{t("machines.demoBanner")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
