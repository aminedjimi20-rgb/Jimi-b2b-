import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { buildWhatsAppLink } from "@/config/site.config";
import type { Part, PartCondition } from "@/lib/types";
import { Cog, MessageCircle, Mail } from "lucide-react";

const conditionTone: Record<PartCondition, "success" | "accent" | "warning"> = {
  neuf: "success",
  renove: "accent",
  occasion: "warning",
};

export function PartCard({ part }: { part: Part }) {
  const t = useTranslations();
  const waMessage = t("pieces.whatsappRequest", { name: part.name, reference: part.reference });

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm transition-shadow hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-surface-2)]">
        {part.photos && part.photos.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element -- photos live on a user-configured Cloudinary domain, unknown at build time
          <img
            src={part.photos[0]}
            alt={part.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
            <Cog size={40} strokeWidth={1.25} />
          </div>
        )}
        <div className="absolute inset-x-3 top-3 flex flex-wrap gap-2">
          <Badge tone={conditionTone[part.condition]}>{t(`pieces.condition.${part.condition}`)}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            {t("pieces.reference")} {part.reference}
          </p>
          <h3 className="mt-0.5 text-lg font-bold text-[var(--color-ink)]">{part.name}</h3>
        </div>

        {part.description && (
          <p className="line-clamp-3 text-sm text-[var(--color-text-muted)]">{part.description}</p>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t border-[var(--color-border)] pt-3">
          <span className="font-bold text-[var(--color-ink)]">
            {part.priceOnRequest || !part.price
              ? t("machines.priceOnRequest")
              : `${part.price.toLocaleString("fr-FR")} DA`}
          </span>
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
            <Button href="/contact" variant="outline" size="sm" icon={<Mail size={15} />}>
              {t("nav.contact")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
