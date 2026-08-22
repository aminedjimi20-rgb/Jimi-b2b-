import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MachineArt } from "@/components/MachineArt";
import { MachineVideoPlayer } from "@/components/MachineVideoPlayer";
import { MachineInterestForm } from "@/components/MachineInterestForm";
import { JsonLd } from "@/components/JsonLd";
import { getPublicMachineBySlug } from "@/lib/data";
import { getVideoProvider, getAutoVideoThumbnail, getVideoEmbedUrl } from "@/lib/video";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, MapPin, Calendar, Gauge, Mail, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const machine = await getPublicMachineBySlug(slug);
  if (!machine) return {};
  const t = await getTranslations({ locale, namespace: "machineDetail" });
  const title = `${machine.brand} ${machine.model} — ${machine.tonnage}T (${machine.year})`;
  const description = machine.description.slice(0, 155);
  const hasFileVideo = machine.videoUrl && getVideoProvider(machine.videoUrl) === "file";

  return {
    title,
    description,
    alternates: { canonical: `/machines/${slug}` },
    openGraph: {
      title,
      description,
      ...(machine.photos && machine.photos.length > 0 ? { images: [{ url: machine.photos[0] }] } : {}),
      ...(hasFileVideo && machine.videoUrl
        ? { videos: [{ url: machine.videoUrl, type: "video/mp4" }] }
        : {}),
    },
    other: { "machine-specs-title": t("specsTitle") },
  };
}

const statusTone: Record<string, "success" | "danger" | "warning" | "accent"> = {
  published: "success",
  sold: "danger",
  reserved: "warning",
};

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const machine = await getPublicMachineBySlug(slug);
  if (!machine) notFound();

  const t = await getTranslations();
  const machineLabel = `${machine.brand} ${machine.model} ${machine.tonnage}T`;
  const videoThumbnail = machine.videoUrl
    ? machine.videoThumbnail || getAutoVideoThumbnail(machine.videoUrl)
    : null;
  const videoEmbedUrl = machine.videoUrl ? getVideoEmbedUrl(machine.videoUrl) : null;

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
              machine.status === "published"
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
          },
        }}
      />

      {machine.videoUrl && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: machine.videoTitle || `${machine.brand} ${machine.model} — ${t("machineDetail.videoSectionTitle")}`,
            description: machine.description,
            thumbnailUrl: videoThumbnail ?? undefined,
            ...(videoEmbedUrl
              ? { embedUrl: videoEmbedUrl }
              : { contentUrl: machine.videoUrl }),
          }}
        />
      )}

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
              {machine.photos && machine.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {machine.photos.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- photos live on a user-configured Firebase Storage domain, unknown at build time
                    <img
                      key={url}
                      src={url}
                      alt={`${machine.brand} ${machine.model} — photo ${i + 1}`}
                      loading={i === 0 ? "eager" : "lazy"}
                      className="aspect-square rounded-lg border border-[var(--color-border)] object-cover"
                    />
                  ))}
                </div>
              ) : (
                <div className="aspect-video overflow-hidden rounded-lg bg-[var(--color-ink)]">
                  <MachineArt seed={0} className="h-full w-full object-cover" />
                </div>
              )}

              {machine.videoUrl && (
                <>
                  <h2 className="mt-10 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                    {t("machineDetail.videoSectionTitle")}
                  </h2>
                  <MachineVideoPlayer
                    videoUrl={machine.videoUrl}
                    videoThumbnail={videoThumbnail}
                    videoTitle={machine.videoTitle}
                  />
                  <div className="mt-4 flex flex-col items-start gap-2 rounded-lg bg-[var(--color-surface-2)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-[var(--color-ink)]">
                      {t("machineDetail.interestedTitle")}
                    </p>
                    <a
                      href="#interest-form"
                      className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
                    >
                      {t("cta.imInterested")} →
                    </a>
                  </div>
                </>
              )}

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

                <div
                  id="interest-form"
                  className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6"
                >
                  <h2 className="text-base font-bold text-[var(--color-ink)]">
                    {t("machineDetail.interestedTitle")}
                  </h2>
                  <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
                    {t("machineDetail.interestedSubtitle")}
                  </p>
                  <div className="mt-5">
                    <MachineInterestForm machineId={machine.id} machineLabel={machineLabel} />
                  </div>
                  <div className="mt-3 flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
                    <Button href="/contact" variant="outline" size="sm" icon={<Mail size={16} />}>
                      {t("cta.requestInfo")}
                    </Button>
                    <Button href="/contact" variant="ghost" size="sm" icon={<CalendarClock size={16} />}>
                      {t("cta.scheduleInspection")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
