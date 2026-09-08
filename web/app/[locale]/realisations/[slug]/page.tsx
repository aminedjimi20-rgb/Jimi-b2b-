import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { MachineVideoPlayer } from "@/components/MachineVideoPlayer";
import { getPublicProjectBySlug } from "@/lib/data";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublicProjectBySlug(slug);
  if (!project) return {};
  return {
    title: `${project.title} — ${project.brand} ${project.tonnage}T`,
    description: project.result.slice(0, 155),
    alternates: { canonical: `/realisations/${slug}` },
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
  const tCta = await getTranslations("cta");

  return (
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
          </div>

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
  );
}
