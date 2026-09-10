import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/Badge";
import { MachineArt } from "@/components/MachineArt";
import type { MachineStatus } from "@/lib/types";
import type { PublicMachine } from "@/lib/data";
import { MapPin, Gauge, Calendar, Video } from "lucide-react";

const statusTone: Record<MachineStatus, "success" | "danger" | "warning" | "accent"> = {
  published: "success",
  sold: "danger",
  reserved: "warning",
  draft: "accent",
  pending: "accent",
  rejected: "danger",
};

export function MachineCard({
  machine,
  index = 0,
  layout = "grid",
}: {
  machine: PublicMachine;
  index?: number;
  layout?: "grid" | "list";
}) {
  const t = useTranslations();

  const photo =
    machine.photos && machine.photos.length > 0 ? (
      // eslint-disable-next-line @next/next/no-img-element -- photos live on a user-configured Firebase Storage domain, unknown at build time
      <img
        src={machine.photos[0]}
        alt={`${machine.brand} ${machine.model}`}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    ) : (
      <MachineArt seed={index} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
    );

  const badges = (
    <>
      <Badge tone={statusTone[machine.status]}>{t(`badges.${machine.status}`)}</Badge>
      {machine.isPromo && <Badge tone="warning">{t("badges.promo")}</Badge>}
      {machine.isDemo && (
        <Badge tone="neutral" className="bg-white/90 text-slate-700 ring-white/50">
          {t("demoDataBadge")}
        </Badge>
      )}
    </>
  );

  const specs = (
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
  );

  const price = machine.priceOnRequest || !machine.price
    ? t("machines.priceOnRequest")
    : `${machine.price.toLocaleString("fr-FR")} DA`;

  if (layout === "list") {
    return (
      <Link
        href={`/machines/${machine.slug}`}
        className="group flex flex-row overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
      >
        <div className="relative w-28 shrink-0 overflow-hidden bg-[var(--color-ink)] sm:w-56">
          {photo}
          <div className="absolute inset-x-1.5 top-1.5 flex flex-wrap items-center gap-1 sm:inset-x-3 sm:top-3 sm:gap-2 [&_span]:px-1.5 [&_span]:py-0.5 [&_span]:text-[10px] sm:[&_span]:px-2.5 sm:[&_span]:py-1 sm:[&_span]:text-xs">
            {badges}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-2 p-3 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
              {machine.brand}
            </p>
            <h3 className="mt-0.5 text-base font-bold text-[var(--color-ink)] sm:text-lg">{machine.model}</h3>
            <div className="mt-1 hidden sm:block">{specs}</div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--color-border)] pt-2 sm:w-52 sm:items-end sm:gap-1.5 sm:border-t-0 sm:border-s sm:ps-6 sm:pt-0 sm:text-end">
            <span className="font-bold text-[var(--color-ink)]">{price}</span>
            <span className="text-sm font-semibold text-[var(--color-accent)] group-hover:underline">
              {t("cta.viewDetails")}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/machines/${machine.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-ink)]">
        {photo}
        <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-2">{badges}</div>
        {machine.videoUrl && (
          <div className="absolute inset-x-3 bottom-3 flex">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <Video size={13} />
              {t("machines.videoBadge")}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            {machine.brand}
          </p>
          <h3 className="mt-0.5 text-lg font-bold text-[var(--color-ink)]">{machine.model}</h3>
        </div>

        {specs}

        <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-3">
          <span className="font-bold text-[var(--color-ink)]">{price}</span>
          <span className="text-sm font-semibold text-[var(--color-accent)] group-hover:underline">
            {t("cta.viewDetails")}
          </span>
        </div>
      </div>
    </Link>
  );
}
