import { ReactNode } from "react";
import clsx from "clsx";

type Tone = "accent" | "success" | "warning" | "neutral" | "danger";

const toneClasses: Record<Tone, string> = {
  accent: "bg-blue-50 text-[var(--color-accent)] ring-1 ring-inset ring-blue-100",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-100",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
