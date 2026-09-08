import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { ProjectCard } from "@/components/ProjectCard";
import { EmptyState } from "@/components/EmptyState";
import { getPublicProjects } from "@/lib/data";
import { buildWhatsAppLink } from "@/config/site.config";
import { ClipboardList } from "lucide-react";

export async function RealisationsPreview() {
  const t = await getTranslations("home.realisations");
  const tw = await getTranslations("whatsappMessages");
  const tc = await getTranslations("cta");
  const projects = (await getPublicProjects()).slice(0, 3);

  return (
    <section className="bg-[var(--color-surface-2)] py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="Portfolio" title={t("title")} subtitle={t("subtitle")} />

        {projects.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xl">
            <EmptyState
              icon={ClipboardList}
              title={t("emptyTitle")}
              subtitle={t("emptySubtitle")}
              whatsappHref={buildWhatsAppLink(tw("serviceQuote"))}
              whatsappLabel={tc("whatsapp")}
            />
          </div>
        ) : (
          <>
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
          </>
        )}
      </Container>
    </section>
  );
}
