import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { Zap, Cpu, Box, Droplet, Cog, Settings2, MonitorCog, SlidersHorizontal, RotateCw, ArrowRight, Package } from "lucide-react";
import type { PartCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORIES: { key: PartCategory; icon: typeof Cpu }[] = [
  { key: "electrique", icon: Zap },
  { key: "electronique", icon: Cpu },
  { key: "hydraulique", icon: Droplet },
  { key: "mecanique", icon: Cog },
  { key: "automatisme", icon: Settings2 },
  { key: "plc-hmi", icon: MonitorCog },
  { key: "variateurs", icon: SlidersHorizontal },
  { key: "servo-moteurs", icon: RotateCw },
  { key: "moules", icon: Box },
  { key: "autre", icon: Package },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pieces" });
  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates: buildAlternates("/pieces-industrielles", locale),
  };
}

export default async function PiecesIndustriellesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pieces");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map(({ key, icon: Icon }) => {
              const examples = t.raw(`categories.${key}.examples`) as string[];
              return (
                <Link
                  key={key}
                  href={`/pieces-industrielles/${key}`}
                  className="group flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
                      <Icon size={22} />
                    </span>
                    <h3 className="text-xl font-bold text-[var(--color-ink)]">
                      {t(`categories.${key}.title`)}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                    {t(`categories.${key}.description`)}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {examples.map((example) => (
                      <li
                        key={example}
                        className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs font-medium text-[var(--color-text)]"
                      >
                        {example}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] group-hover:underline">
                    {t("viewCategory")} <ArrowRight size={15} />
                  </span>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>
    </>
  );
}
