"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Factory, LogOut, ExternalLink } from "lucide-react";

export function AdminTopBar() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-ink)] text-white">
            <Factory size={18} />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-[var(--color-ink)]">
              Administration JIMI Industrie
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Tableau de bord interne</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            <ExternalLink size={14} /> Voir le site
          </a>
          <button
            type="button"
            onClick={logout}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3 py-2 text-sm font-medium text-white hover:bg-[#1b262f]"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}
