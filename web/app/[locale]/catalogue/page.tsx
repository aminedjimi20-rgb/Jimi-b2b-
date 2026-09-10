import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { Factory, Cog, Box, ArrowRight, PackageSearch } from "lucide-react";

export const dynamic = "force-dynamic";

const CARDS = [
  { key: "machines", href: "/machines", icon: Factory },
  { key: "pieces", href: "/pieces-industrielles", icon: Cog },
  { key: "moules", href: "/pieces-industrielles/moules", icon: Box },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalogueHub" });
  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates: buildAlternates("/catalogue", locale),
  };
}

export default async function CataloguePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalogueHub");
  const tn = await getTranslations("nav");

  return (
    <>
      <Breadcrumbs
        locale={locale}
        items={[{ label: tn("home"), href: "/" }, { label: t("eyebrow") }]}
      />
      <PageHeader eyebrow={t("eyebrow")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {CARDS.map(({ key, href, icon: Icon }) => (
              <Link
                key={key}
                href={href}
                className="group flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
                  <Icon size={22} />
                </span>
                <h3 className="text-xl font-bold text-[var(--color-ink)]">{t(`cards.${key}.title`)}</h3>
                <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {t(`cards.${key}.description`)}
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] group-hover:underline">
                  {t(`cards.${key}.cta`)} <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>

          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 text-center">
            <PackageSearch size={22} className="text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">{t("notFound")}</p>
            <Link
              href="/acheter"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] hover:underline"
            >
              {t("notFoundCta")} <ArrowRight size={15} />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
