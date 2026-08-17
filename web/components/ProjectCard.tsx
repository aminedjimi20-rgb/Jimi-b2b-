import { getTranslations } from "next-intl/server";
import { MachineArt } from "@/components/MachineArt";
import { Badge } from "@/components/ui/Badge";
import type { Project } from "@/lib/types";

export async function ProjectCard({ project, index = 0 }: { project: Project; index?: number }) {
  const t = await getTranslations("realisations.labels");

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-ink)]">
        <MachineArt seed={index + 2} className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-base font-bold leading-snug text-[var(--color-ink)]">
          {project.title}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{project.brand}</Badge>
          <Badge tone="neutral">{project.tonnage} T</Badge>
        </div>
        <dl className="mt-1 space-y-2.5 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t("problem")}
            </dt>
            <dd className="mt-0.5 text-[var(--color-text)]">{project.problem}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t("result")}
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--color-ink)]">{project.result}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
