import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { MachineVideoPlayer } from "@/components/MachineVideoPlayer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { buildAlternates } from "@/lib/seo";
import { getPublicProjectBySlug } from "@/lib/data";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = await getPublicProjectBySlug(slug);
  if (!project) return {};
  return {
    title: `${project.title} — ${project.brand} ${project.tonnage}T`,
    description: project.result.slice(0, 155),
    alternates: buildAlternates(`/realisations/${slug}`, locale),
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const project = await getPublicProjectBySlug(slug);
  if (!project) notFound();

  const t = await getTranslations("realisations.labels");
  const tTypes = await getTranslations("realisations.interventionTypes");
  const tCta = await getTranslations("cta");
  const tn = await getTranslations("nav");

  return (
    <>
      <Breadcrumbs
        locale={locale}
        items={[
          { label: tn("home"), href: "/" },
          { label: tn("realisations"), href: "/realisations" },
          { label: project.title },
        ]}
      />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Link
              href="/realisations"
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] hover:underline"
            >
              <ArrowLeft size={15} />
              {tCta("backToRealisations")}
            </Link>

            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
              {project.title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="accent">{project.brand}</Badge>
              <Badge tone="neutral">{project.tonnage} T</Badge>
              {project.interventionType && (
                <Badge tone="neutral">{tTypes(project.interventionType)}</Badge>
              )}
            </div>

            {project.photos && project.photos.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {project.photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- photo lives on a user-configured Cloudinary domain, unknown at build time
                  <img
                    key={url}
                    src={url}
                    alt={`${project.title} — photo ${i + 1}`}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="aspect-square rounded-lg border border-[var(--color-border)] object-cover"
                  />
                ))}
              </div>
            )}

            {project.videoUrl && (
              <div className="mt-8">
                <MachineVideoPlayer
                  videoUrl={project.videoUrl}
                  videoThumbnail={project.videoThumbnail}
                  videoTitle={project.videoTitle}
                />
              </div>
            )}

            <dl className="mt-8 space-y-6">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("problem")}
                </dt>
                <dd className="mt-1.5 text-base leading-relaxed text-[var(--color-text)]">{project.problem}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("solution")}
                </dt>
                <dd className="mt-1.5 text-base leading-relaxed text-[var(--color-text)]">{project.solution}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("result")}
                </dt>
                <dd className="mt-1.5 text-base font-medium leading-relaxed text-[var(--color-ink)]">
                  {project.result}
                </dd>
              </div>
            </dl>
          </div>
        </Container>
      </section>
    </>
  );
}
