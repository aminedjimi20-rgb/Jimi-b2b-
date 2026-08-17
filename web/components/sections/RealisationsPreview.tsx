import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { ProjectCard } from "@/components/ProjectCard";
import { getProjects } from "@/lib/data";

export async function RealisationsPreview() {
  const t = await getTranslations("home.realisations");
  const projects = getProjects().slice(0, 3);

  return (
    <section className="bg-[var(--color-surface-2)] py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="Portfolio" title={t("title")} subtitle={t("subtitle")} />

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {projects.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button href="/realisations" variant="outline">
            {t("viewAll")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
