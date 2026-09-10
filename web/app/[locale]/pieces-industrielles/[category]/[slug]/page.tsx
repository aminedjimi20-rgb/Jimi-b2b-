import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { GenericBuyRequestForm } from "@/components/forms/BuyEquipmentForm";
import { getPublicPartBySlug } from "@/lib/data";
import { buildAlternates, absoluteUrl } from "@/lib/seo";
import { buildWhatsAppLink, siteConfig } from "@/config/site.config";
import type { PartCategory } from "@/lib/types";
import { MessageCircle, Phone, Cog } from "lucide-react";

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
  params: Promise<{ locale: string; category: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, category, slug } = await params;
  if (!isValidCategory(category)) return {};
  const part = await getPublicPartBySlug(slug);
  if (!part || part.category !== category) return {};
  const t = await getTranslations({ locale, namespace: "pieces" });
  const categoryLabel = t(`categories.${category}.title`);
  const title = `${part.name}${part.reference ? ` — ${part.reference}` : ""} | ${categoryLabel}`;
  const description = part.description
    ? part.description.slice(0, 155)
    : t("categories." + category + ".seoDescription");

  return {
    title,
    description,
    alternates: buildAlternates(`/pieces-industrielles/${category}/${slug}`, locale),
    openGraph: {
      title,
      description,
      ...(part.photos && part.photos.length > 0 ? { images: [{ url: part.photos[0] }] } : {}),
    },
  };
}

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}) {
  const { locale, category, slug } = await params;
  if (!isValidCategory(category)) notFound();
  setRequestLocale(locale);
  const part = await getPublicPartBySlug(slug);
  // La catégorie de l'URL doit correspondre à la vraie catégorie de la
  // pièce (pas de contenu dupliqué accessible via deux chemins différents).
  if (!part || part.category !== category) notFound();

  const t = await getTranslations();
  const waMessage = t("pieces.whatsappRequest", { name: part.name, reference: part.reference });

  const specRows: [string, string | undefined][] = [
    [t("partDetail.specs.brand"), part.brand],
    [t("partDetail.specs.model"), part.model],
    [t("partDetail.specs.reference"), part.reference],
    [t("partDetail.specs.condition"), t(`pieces.condition.${part.condition}`)],
    [t("partDetail.specs.wilaya"), part.wilaya],
    [
      t("partDetail.specs.price"),
      part.priceOnRequest || !part.price
        ? t("machines.priceOnRequest")
        : `${part.price.toLocaleString("fr-FR")} DA`,
    ],
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: part.name,
          ...(part.brand ? { brand: part.brand } : {}),
          ...(part.model ? { model: part.model } : {}),
          sku: part.reference,
          description: part.description || t(`pieces.categories.${category}.description`),
          ...(part.photos && part.photos.length > 0 ? { image: part.photos } : {}),
          offers: {
            "@type": "Offer",
            priceCurrency: "DZD",
            ...(part.price && !part.priceOnRequest ? { price: part.price } : {}),
            availability:
              part.status === "published"
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            url: absoluteUrl(`/pieces-industrielles/${category}/${slug}`, locale),
          },
        }}
      />

      <Breadcrumbs
        locale={locale}
        items={[
          { label: t("nav.home"), href: "/" },
          { label: t("nav.piecesShort"), href: "/pieces-industrielles" },
          { label: t(`pieces.categories.${category}.title`), href: `/pieces-industrielles/${category}` },
          { label: part.name },
        ]}
      />

      <section className="py-10 md:py-14">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="accent">{t(`pieces.categories.${category}.title`)}</Badge>
                {part.isPromo && <Badge tone="warning">{t("badges.promo")}</Badge>}
                {part.isDemo && <Badge tone="neutral">{t("demoDataBadge")}</Badge>}
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
                {part.name}
              </h1>
              <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                {t("pieces.reference")} {part.reference}
              </p>

              <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                {t("partDetail.galleryTitle")}
              </h2>
              {part.photos && part.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {part.photos.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- photos live on a user-configured Cloudinary domain, unknown at build time
                    <img
                      key={url}
                      src={url}
                      alt={`${part.name} — photo ${i + 1}`}
                      loading={i === 0 ? "eager" : "lazy"}
                      className="aspect-square rounded-lg border border-[var(--color-border)] object-cover"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                  <Cog size={48} strokeWidth={1.25} />
                </div>
              )}

              {part.description && (
                <>
                  <h2 className="mt-10 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                    {t("partDetail.descriptionTitle")}
                  </h2>
                  <p className="text-sm leading-relaxed text-[var(--color-text)]">{part.description}</p>
                </>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="sticky top-24 flex flex-col gap-6">
                <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                  <h2 className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
                    {t("partDetail.specsTitle")}
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

                <div className="flex flex-col gap-2">
                  <Button
                    href={buildWhatsAppLink(waMessage)}
                    external
                    variant="whatsapp"
                    icon={<MessageCircle size={17} />}
                  >
                    {t("pieces.requestPrice")}
                  </Button>
                  <Button
                    href={`tel:${siteConfig.contact.phoneHref}`}
                    external
                    variant="outline"
                    icon={<Phone size={17} />}
                  >
                    {t("cta.callNow")}
                  </Button>
                </div>

                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6">
                  <h2 className="text-base font-bold text-[var(--color-ink)]">
                    {t("partDetail.interestedTitle")}
                  </h2>
                  <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
                    {t("partDetail.interestedSubtitle")}
                  </p>
                  <div className="mt-5">
                    <GenericBuyRequestForm
                      buyType={category === "moules" ? "moule" : "piece"}
                      defaultReference={`${part.name} (${part.reference})`}
                    />
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
