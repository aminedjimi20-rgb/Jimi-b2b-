import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "@/i18n/navigation";
import { MachineArt } from "@/components/MachineArt";
import { Badge } from "@/components/ui/Badge";
import { getArticles } from "@/lib/data";
import { Clock, ArrowRight } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
    alternates: buildAlternates("/blog", locale),
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const articles = getArticles(locale);

  return (
    <>
      <PageHeader eyebrow="Blog" title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, i) => (
              <Link
                key={article.id}
                href={`/blog/${article.slug}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="aspect-[16/10] overflow-hidden bg-[var(--color-ink)]">
                  <MachineArt seed={i + 4} className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <Badge tone="accent" className="self-start">
                    {article.category}
                  </Badge>
                  <h2 className="text-base font-bold leading-snug text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                    {article.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                    {article.excerpt}
                  </p>
                  <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={13} /> {article.readTimeMinutes} {t("readTime")}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)]">
                      <ArrowRight size={13} className="rtl:rotate-180" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
