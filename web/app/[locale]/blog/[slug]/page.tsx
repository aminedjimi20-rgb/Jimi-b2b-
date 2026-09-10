import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { MachineArt } from "@/components/MachineArt";
import { Badge } from "@/components/ui/Badge";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { buildAlternates } from "@/lib/seo";
import { getArticleBySlug, getArticles } from "@/lib/data";
import { buildWhatsAppLink } from "@/config/site.config";
import { routing } from "@/i18n/routing";
import { ArrowLeft, ArrowRight, Clock, MessageCircle } from "lucide-react";

export function generateStaticParams() {
  const articles = getArticles();
  return routing.locales.flatMap((locale) => articles.map((a) => ({ locale, slug: a.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getArticleBySlug(locale, slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.excerpt,
    alternates: buildAlternates(`/blog/${slug}`, locale),
    openGraph: { title: article.title, description: article.excerpt, type: "article" },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = getArticleBySlug(locale, slug);
  if (!article) notFound();

  const t = await getTranslations();
  const related = getArticles(locale)
    .filter((a) => a.slug !== article.slug)
    .slice(0, 3);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.excerpt,
          datePublished: article.publishedAt,
          articleSection: article.category,
        }}
      />

      <Breadcrumbs
        locale={locale}
        items={[
          { label: t("nav.home"), href: "/" },
          { label: t("nav.blogShort"), href: "/blog" },
          { label: article.title },
        ]}
      />

      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] py-4">
        <Container>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          >
            <ArrowLeft size={15} className="rtl:rotate-180" />
            {t("cta.backToBlog")}
          </Link>
        </Container>
      </section>

      <article className="py-10 md:py-14">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Badge tone="accent">{article.category}</Badge>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
              {article.title}
            </h1>
            <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Clock size={14} />
              {article.readTimeMinutes} {t("blog.readTime")}
            </div>

            <div className="mt-8 aspect-[21/9] overflow-hidden rounded-xl bg-[var(--color-ink)]">
              <MachineArt seed={5} className="h-full w-full object-cover" />
            </div>

            <div className="mt-8 flex flex-col gap-4">
              {article.content.map((paragraph, i) => (
                <p key={i} className="text-base leading-relaxed text-[var(--color-text)]">
                  {paragraph}
                </p>
              ))}
            </div>

            {article.relatedLinks && article.relatedLinks.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-6">
                {article.relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-accent)] hover:border-[var(--color-accent)]"
                  >
                    {link.label} →
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-10 flex flex-col items-start gap-4 rounded-xl bg-[var(--color-surface-2)] p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--color-ink)]">{t("blog.cta.title")}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("blog.cta.subtitle")}</p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
                <Button href="/contact" icon={<ArrowRight size={16} className="rtl:rotate-180" />}>
                  {t("blog.cta.quote")}
                </Button>
                <Button
                  href={buildWhatsAppLink(t("whatsappMessages.generalContact"))}
                  external
                  variant="whatsapp"
                  icon={<MessageCircle size={16} />}
                >
                  {t("blog.cta.whatsapp")}
                </Button>
              </div>
            </div>
          </div>

          {related.length > 0 && (
            <div className="mx-auto mt-16 max-w-4xl border-t border-[var(--color-border)] pt-10">
              <h2 className="mb-6 text-lg font-bold text-[var(--color-ink)]">
                {t("blog.relatedTitle")}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {related.map((a) => (
                  <Link
                    key={a.id}
                    href={`/blog/${a.slug}`}
                    className="rounded-lg border border-[var(--color-border)] bg-white p-4 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  >
                    {a.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Container>
      </article>
    </>
  );
}
