import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EmptyState } from "@/components/EmptyState";
import { OfferForm } from "@/components/forms/OfferForm";
import { getPublicWantedListings } from "@/lib/wantedListingsStore";
import { buildWhatsAppLink } from "@/config/site.config";
import { Factory, Cog, Box, MoreHorizontal, MapPin, Megaphone } from "lucide-react";
import type { WantedCategory } from "@/lib/wantedListingsStore";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_ICONS: Record<WantedCategory, LucideIcon> = {
  machine: Factory,
  piece: Cog,
  moule: Box,
  autre: MoreHorizontal,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "wanted" });
  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates: buildAlternates("/recherches", locale),
  };
}

export default async function WantedListingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("wanted");
  const tn = await getTranslations("nav");
  const tw = await getTranslations("whatsappMessages");
  const tc = await getTranslations("cta");
  const listings = await getPublicWantedListings();

  return (
    <>
      <Breadcrumbs locale={locale} items={[{ label: tn("home"), href: "/" }, { label: t("eyebrow") }]} />
      <PageHeader eyebrow={t("eyebrow")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          {listings.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title={t("emptyTitle")}
              subtitle={t("emptySubtitle")}
              whatsappHref={buildWhatsAppLink(tw("generalContact"))}
              whatsappLabel={tc("whatsapp")}
            />
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {listings.map((listing) => {
                const Icon = CATEGORY_ICONS[listing.category];
                return (
                  <div key={listing.id} className="rounded-xl border border-[var(--color-border)] bg-white p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-[var(--color-ink)]">{listing.title}</h3>
                        {listing.wilaya && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <MapPin size={11} /> {listing.wilaya}
                          </p>
                        )}
                        {listing.description && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text)]">
                            {listing.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                      <OfferForm wantedListingId={listing.id} wantedTitle={listing.title} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
