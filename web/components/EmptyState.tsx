import { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  whatsappHref,
  whatsappLabel,
}: {
  icon: LucideIcon;
  title: ReactNode;
  subtitle: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  whatsappHref?: string;
  whatsappLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--color-border)] bg-white px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-accent)]">
        <Icon size={22} />
      </span>
      <h3 className="text-base font-bold text-[var(--color-ink)]">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-[var(--color-text-muted)]">{subtitle}</p>
      {(ctaHref || whatsappHref) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {ctaHref && ctaLabel && <Button href={ctaHref}>{ctaLabel}</Button>}
          {whatsappHref && whatsappLabel && (
            <Button href={whatsappHref} external variant="whatsapp" icon={<MessageCircle size={16} />}>
              {whatsappLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
