import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MachineArt } from "@/components/MachineArt";
import { Badge } from "@/components/ui/Badge";
import type { Project } from "@/lib/types";
import { Video } from "lucide-react";

export async function ProjectCard({ project, index = 0 }: { project: Project; index?: number }) {
  const t = await getTranslations("realisations.labels");
  const tMachines = await getTranslations("machines");

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
      <Link href={`/realisations/${project.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-[var(--color-ink)]">
        <MachineArt seed={index + 2} className="h-full w-full object-cover" />
        {project.videoUrl && (
          <div className="absolute inset-x-3 top-3 flex">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <Video size={13} />
              {tMachines("videoBadge")}
            </span>
          </div>
        )}
      </Link>
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
