"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search } from "lucide-react";

export function SearchBar({
  initialQuery = "",
  placeholder,
  autoFocus,
  size = "md",
  onSubmitted,
}: {
  initialQuery?: string;
  placeholder: string;
  autoFocus?: boolean;
  size?: "md" | "lg";
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/recherche?q=${encodeURIComponent(q)}` : "/recherche");
    onSubmitted?.();
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex w-full items-center">
      <Search
        size={size === "lg" ? 18 : 16}
        className="pointer-events-none absolute start-3.5 text-[var(--color-text-muted)]"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={
          size === "lg"
            ? "w-full rounded-lg border border-[var(--color-border)] bg-white py-3 ps-10 pe-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
            : "w-full rounded-lg border border-[var(--color-border)] bg-white py-2 ps-9 pe-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
        }
      />
    </form>
  );
}
