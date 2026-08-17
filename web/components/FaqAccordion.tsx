"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] md:text-base"
              aria-expanded={open}
            >
              {item.q}
              <ChevronDown
                size={18}
                className={clsx(
                  "shrink-0 text-[var(--color-text-muted)] transition-transform",
                  open && "rotate-180 text-[var(--color-accent)]"
                )}
              />
            </button>
            <div
              className={clsx(
                "grid transition-all duration-200 ease-out",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
