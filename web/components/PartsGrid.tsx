"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, List } from "lucide-react";
import { PartCard } from "@/components/PartCard";
import type { Part } from "@/lib/types";

export function PartsGrid({ parts }: { parts: Part[] }) {
  const t = useTranslations("pieces");
  const [view, setView] = useState<"grid" | "list">("grid");

  return (
    <div>
      <div className="mb-6 flex justify-end gap-2">
        <button
          onClick={() => setView("grid")}
          aria-pressed={view === "grid"}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
            view === "grid"
              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
              : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
          }`}
        >
          <LayoutGrid size={15} /> {t("viewGrid")}
        </button>
        <button
          onClick={() => setView("list")}
          aria-pressed={view === "list"}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
            view === "list"
              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
              : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
          }`}
        >
          <List size={15} /> {t("viewList")}
        </button>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {parts.map((part) => (
            <PartCard key={part.id} part={part} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {parts.map((part) => (
            <PartCard key={part.id} part={part} layout="list" />
          ))}
        </div>
      )}
    </div>
  );
}
