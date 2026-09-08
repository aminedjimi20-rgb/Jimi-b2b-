"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown } from "lucide-react";
import clsx from "clsx";

const LABELS: Record<string, string> = { fr: "Français", ar: "العربية", en: "English" };
const SHORT: Record<string, string> = { fr: "FR", ar: "AR", en: "EN" };

export function LanguageSwitcher({
  compact = false,
  align = "end",
  dropUp = false,
}: {
  compact?: boolean;
  /** Which side of the button the dropdown's own edge anchors to. Use "start"
   *  when the button sits near the start of a row (e.g. the mobile menu
   *  panel) — anchoring "end" there would open the dropdown toward the
   *  viewport edge behind it and clip off-screen. */
  align?: "start" | "end";
  /** Open above the button instead of below. Use this when the button sits
   *  at the bottom of a container with its own overflow/scroll (e.g. the
   *  mobile menu panel) — opening downward there gets clipped by that
   *  container instead of showing on top of it. */
  dropUp?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("langSwitcher");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t("label")}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors",
          compact && "px-2 py-1.5"
        )}
      >
        <Globe size={16} />
        <span>{SHORT[locale]}</span>
        <ChevronDown size={14} className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className={clsx(
            "absolute z-50 w-40 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-lg",
            align === "start" ? "start-0" : "end-0",
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {routing.locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => {
                setOpen(false);
                router.replace(pathname, { locale: loc });
              }}
              className={clsx(
                "flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-[var(--color-surface-2)]",
                loc === locale ? "font-semibold text-[var(--color-accent)]" : "text-[var(--color-text)]"
              )}
            >
              {LABELS[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
