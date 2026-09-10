import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildAlternates } from "@/lib/seo";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { PartsGrid } from "@/components/PartsGrid";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { getPublicPartsByCategory } from "@/lib/data";
import { buildWhatsAppLink } from "@/config/site.config";
import type { PartCategory } from "@/lib/types";
import { Cog, CheckCircle2, MessageCircle, ArrowRight } from "lucide-react";

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

/** Page de service la plus pertinente pour chaque catégorie — utilisée pour
 *  le maillage interne dans la note "servicesNote". */
const SERVICE_LINK: Record<PartCategory, string> = {
  electrique: "/services/maintenance-depannage",
  electronique: "/services/maintenance-depannage",
  hydraulique: "/services/maintenance-depannage",
  mecanique: "/services/maintenance-depannage",
  moules: "/services/maintenance-depannage",
  automatisme: "/services/automatisation-industrielle",
  "plc-hmi": "/services/automatisation-industrielle",
  variateurs: "/services/automatisation-industrielle",
  "servo-moteurs": "/services/automatisation-industrielle",
};

/** Catégories connexes affichées en bas de page, pour le maillage interne
 *  entre catégories proches. */
const RELATED_CATEGORIES: Record<PartCategory, PartCategory[]> = {
  electrique: ["electronique", "automatisme"],
  electronique: ["electrique", "plc-hmi"],
  hydraulique: ["mecanique", "moules"],
  mecanique: ["hydraulique", "moules"],
  automatisme: ["plc-hmi", "electrique"],
  "plc-hmi": ["automatisme", "variateurs"],
  variateurs: ["servo-moteurs", "plc-hmi"],
  "servo-moteurs": ["variateurs", "plc-hmi"],
  moules: ["mecanique", "hydraulique"],
};

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
    alternates: buildAlternates(`/pieces-industrielles/${category}`, locale),
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
  const tn = await getTranslations("nav");
  const parts = await getPublicPartsByCategory(category);

  const applications = t.raw(`categories.${category}.applications`) as string[];
  const faq = t.raw(`categories.${category}.faq`) as { q: string; a: string }[];
  const relatedKeys = RELATED_CATEGORIES[category];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      <Breadcrumbs
        locale={locale}
        items={[
          { label: tn("home"), href: "/" },
          { label: tn("piecesShort"), href: "/pieces-industrielles" },
          { label: t(`categories.${category}.title`) },
        ]}
      />
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

          <div className="mt-14 rounded-xl border border-[var(--color-border)] bg-white p-6 md:p-8">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">{t("applicationsTitle")}</h2>
            <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {applications.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-6 border-t border-[var(--color-border)] pt-6 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t(`categories.${category}.servicesNote`)}{" "}
              <Link href={SERVICE_LINK[category]} className="font-semibold text-[var(--color-accent)] hover:underline">
                {tn("services")} →
              </Link>
            </p>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">{t("faqTitle")}</h2>
            <div className="mt-4 flex flex-col gap-3">
              {faq.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-lg border border-[var(--color-border)] bg-white p-4 open:shadow-sm"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--color-ink)]">
                    {item.q}
                  </summary>
                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-text-muted)]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start gap-4 rounded-xl bg-[var(--color-surface-2)] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--color-ink)]">{t("notFoundBanner.title")}</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("notFoundBanner.subtitle")}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button href="/acheter-machine" icon={<ArrowRight size={16} />}>
                {t("notFoundBanner.cta")}
              </Button>
              <Button
                href={buildWhatsAppLink(tw("generalContact"))}
                external
                variant="whatsapp"
                icon={<MessageCircle size={16} />}
              >
                {tc("whatsapp")}
              </Button>
            </div>
          </div>

          <div className="mt-10 border-t border-[var(--color-border)] pt-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t("relatedTitle")}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedKeys.map((key) => (
                <Link
                  key={key}
                  href={`/pieces-industrielles/${key}`}
                  className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  {t(`categories.${key}.title`)}
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
