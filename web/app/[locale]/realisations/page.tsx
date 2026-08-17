import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { ProjectCard } from "@/components/ProjectCard";
import { getProjects } from "@/lib/data";
import { Info } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "realisations" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
    alternates: { canonical: "/realisations" },
  };
}

export default async function RealisationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("realisations");
  const projects = getProjects();

  return (
    <>
      <PageHeader eyebrow="Portfolio" title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mb-8 flex items-start gap-2.5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Info size={16} className="mt-0.5 shrink-0" />
            <p>{t("demoBanner")}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
