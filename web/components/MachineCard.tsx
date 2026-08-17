import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/Badge";
import { MachineArt } from "@/components/MachineArt";
import type { Machine } from "@/lib/types";
import { MapPin, Gauge, Calendar } from "lucide-react";

const statusTone: Record<Machine["status"], "success" | "danger" | "warning" | "accent"> = {
  disponible: "success",
  vendue: "danger",
  reservee: "warning",
  nouveau: "accent",
};

export function MachineCard({ machine, index = 0 }: { machine: Machine; index?: number }) {
  const t = useTranslations();

  return (
    <Link
      href={`/machines/${machine.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-ink)]">
        <MachineArt seed={index} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[machine.status]}>{t(`badges.${machine.status}`)}</Badge>
          {machine.isDemo && (
            <Badge tone="neutral" className="bg-white/90 text-slate-700 ring-white/50">
              {t("demoDataBadge")}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            {machine.brand}
          </p>
          <h3 className="mt-0.5 text-lg font-bold text-[var(--color-ink)]">{machine.model}</h3>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Gauge size={14} /> {machine.tonnage} T
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={14} /> {machine.year}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} /> {machine.wilaya}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-3">
          <span className="font-bold text-[var(--color-ink)]">
            {machine.priceOnRequest || !machine.price
              ? t("machines.priceOnRequest")
              : `${machine.price.toLocaleString("fr-FR")} DA`}
          </span>
          <span className="text-sm font-semibold text-[var(--color-accent)] group-hover:underline">
            {t("cta.viewDetails")}
          </span>
        </div>
      </div>
    </Link>
  );
}
