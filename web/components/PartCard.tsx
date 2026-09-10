import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { buildWhatsAppLink, siteConfig } from "@/config/site.config";
import type { Part, PartCondition } from "@/lib/types";
import { Cog, MessageCircle, Phone } from "lucide-react";

const conditionTone: Record<PartCondition, "success" | "accent" | "warning"> = {
  neuf: "success",
  renove: "accent",
  occasion: "warning",
};

export function PartCard({ part, layout = "grid" }: { part: Part; layout?: "grid" | "list" }) {
  const t = useTranslations();
  const waMessage = t("pieces.whatsappRequest", { name: part.name, reference: part.reference });
  const detailHref = `/pieces-industrielles/${part.category}/${part.slug}`;

  const badges = (
    <div className="absolute inset-x-3 top-3 flex flex-wrap gap-2">
      <Badge tone={conditionTone[part.condition]}>{t(`pieces.condition.${part.condition}`)}</Badge>
      {part.isPromo && <Badge tone="warning">{t("badges.promo")}</Badge>}
    </div>
  );

  const image =
    part.photos && part.photos.length > 0 ? (
      // eslint-disable-next-line @next/next/no-img-element -- photos live on a user-configured Cloudinary domain, unknown at build time
      <img src={part.photos[0]} alt={part.name} className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
        <Cog size={40} strokeWidth={1.25} />
      </div>
    );

  const priceAndActions = (
    <div className="flex flex-wrap gap-2">
      <Button
        href={buildWhatsAppLink(waMessage)}
        external
        variant="whatsapp"
        size="sm"
        icon={<MessageCircle size={15} />}
        className="flex-1"
      >
        {t("pieces.requestPrice")}
      </Button>
      <Button
        href={`tel:${siteConfig.contact.phoneHref}`}
        external
        variant="outline"
        size="sm"
        icon={<Phone size={15} />}
      >
        {t("cta.callNow")}
      </Button>
    </div>
  );

  if (layout === "list") {
    return (
      <div className="flex flex-row overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm transition-shadow hover:shadow-lg">
        <Link href={detailHref} className="relative w-28 shrink-0 overflow-hidden bg-[var(--color-surface-2)] sm:w-56">
          {image}
          <div className="absolute inset-x-1.5 top-1.5 flex flex-wrap gap-1 sm:inset-x-3 sm:top-3 sm:gap-2 [&_span]:px-1.5 [&_span]:py-0.5 [&_span]:text-[10px] sm:[&_span]:px-2.5 sm:[&_span]:py-1 sm:[&_span]:text-xs">
            <Badge tone={conditionTone[part.condition]}>{t(`pieces.condition.${part.condition}`)}</Badge>
            {part.isPromo && <Badge tone="warning">{t("badges.promo")}</Badge>}
          </div>
        </Link>

        <div className="flex flex-1 flex-col justify-between gap-2 p-3 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
          <Link href={detailHref} className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
              {t("pieces.reference")} {part.reference}
            </p>
            <h3 className="mt-0.5 text-base font-bold text-[var(--color-ink)] hover:text-[var(--color-accent)] sm:text-lg">
              {part.name}
            </h3>
            {part.description && (
              <p className="mt-1 line-clamp-2 hidden text-sm text-[var(--color-text-muted)] sm:block">
                {part.description}
              </p>
            )}
          </Link>

          <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--color-border)] pt-2 sm:w-64 sm:gap-3 sm:border-t-0 sm:border-s sm:ps-6 sm:pt-0">
            <span className="font-bold text-[var(--color-ink)]">
              {part.priceOnRequest || !part.price
                ? t("machines.priceOnRequest")
                : `${part.price.toLocaleString("fr-FR")} DA`}
            </span>
            {priceAndActions}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm transition-shadow hover:shadow-lg">
      <Link href={detailHref} className="relative aspect-[4/3] overflow-hidden bg-[var(--color-surface-2)]">
        {image}
        {badges}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <Link href={detailHref}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            {t("pieces.reference")} {part.reference}
          </p>
          <h3 className="mt-0.5 text-lg font-bold text-[var(--color-ink)] hover:text-[var(--color-accent)]">
            {part.name}
          </h3>
        </Link>

        {part.description && (
          <p className="line-clamp-3 text-sm text-[var(--color-text-muted)]">{part.description}</p>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t border-[var(--color-border)] pt-3">
          <span className="font-bold text-[var(--color-ink)]">
            {part.priceOnRequest || !part.price
              ? t("machines.priceOnRequest")
              : `${part.price.toLocaleString("fr-FR")} DA`}
          </span>
          {priceAndActions}
        </div>
      </div>
    </div>
  );
}
