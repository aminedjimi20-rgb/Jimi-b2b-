import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EmptyState } from "@/components/EmptyState";
import { MachineCard } from "@/components/MachineCard";
import { PartCard } from "@/components/PartCard";
import { SearchBar } from "@/components/layout/SearchBar";
import { getPublicMachines, getPublicParts } from "@/lib/data";
import { searchMachines, searchParts } from "@/lib/search";
import { buildWhatsAppLink } from "@/config/site.config";
import { SearchX } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    // Résultats de recherche : contenu variable, pas de valeur SEO propre —
    // on garde la page crawlable (pour que le meta soit lu) sans l'indexer.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);
  const query = (q ?? "").trim();
  const t = await getTranslations("search");
  const tw = await getTranslations("whatsappMessages");
  const tc = await getTranslations("cta");
  const tn = await getTranslations("nav");

  const [machines, parts] = query
    ? await Promise.all([getPublicMachines(), getPublicParts()])
    : [[], []];
  const matchedMachines = searchMachines(machines, query);
  const matchedParts = searchParts(parts, query);
  const totalResults = matchedMachines.length + matchedParts.length;

  return (
    <>
      <Breadcrumbs locale={locale} items={[{ label: tn("home"), href: "/" }, { label: t("eyebrow") }]} />
      <PageHeader
        eyebrow={t("eyebrow")}
        title={query ? t("resultsTitle", { query }) : t("pageTitle")}
        subtitle={query ? t("resultsCount", { count: totalResults }) : t("pageSubtitle")}
      />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mx-auto max-w-xl">
            <SearchBar initialQuery={query} placeholder={t("placeholder")} size="lg" />
          </div>

          {!query && (
            <div className="mt-10">
              <EmptyState
                icon={SearchX}
                title={t("noQueryTitle")}
                subtitle={t("noQuerySubtitle")}
              />
            </div>
          )}

          {query && totalResults === 0 && (
            <div className="mt-10">
              <EmptyState
                icon={SearchX}
                title={t("noResultsTitle", { query })}
                subtitle={t("noResultsSubtitle")}
                whatsappHref={buildWhatsAppLink(tw("generalContact"))}
                whatsappLabel={tc("whatsapp")}
              />
            </div>
          )}

          {matchedMachines.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-bold text-[var(--color-ink)]">
                {t("machinesSectionTitle", { count: matchedMachines.length })}
              </h2>
              <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {matchedMachines.map((machine, i) => (
                  <MachineCard key={machine.id} machine={machine} index={i} />
                ))}
              </div>
            </div>
          )}

          {matchedParts.length > 0 && (
            <div className="mt-12">
              <h2 className="text-lg font-bold text-[var(--color-ink)]">
                {t("piecesSectionTitle", { count: matchedParts.length })}
              </h2>
              <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {matchedParts.map((part) => (
                  <PartCard key={part.id} part={part} />
                ))}
              </div>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
