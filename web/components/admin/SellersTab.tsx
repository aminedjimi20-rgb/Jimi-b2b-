"use client";

import { useState } from "react";
import type { Machine } from "@/lib/types";
import type { SellerProfile } from "@/lib/sellers";
import { RefreshCw, MessageCircle, Phone, Mail } from "lucide-react";

const MODERATION_LABELS: Record<string, string> = {
  pending: "En attente",
  published: "Publiée",
  rejected: "Rejetée",
  draft: "Modifs demandées",
};

const MODERATION_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  draft: "bg-orange-50 text-orange-700",
};

export function SellersTab({
  initialSellers,
  machines,
}: {
  initialSellers: SellerProfile[];
  machines: Machine[];
}) {
  const [sellers, setSellers] = useState(initialSellers);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sellers");
      const json = await res.json();
      setSellers(json.sellers ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Coordonnées privées des vendeurs — <strong>jamais visibles publiquement</strong>.
        </p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      {sellers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-text-muted)]">
          Aucun vendeur pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sellers.map((s) => {
            const sellerMachines = machines.filter((m) => m.sellerId === s.id);
            return (
              <div key={s.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[var(--color-ink)]">
                      {s.name} {s.company && <span className="font-normal text-[var(--color-text-muted)]">— {s.company}</span>}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {s.wilaya || "—"} · Inscrit le {new Date(s.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <a
                      href={`https://wa.me/${(s.whatsapp || s.phone).replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#1fa855] hover:underline"
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                    <a
                      href={`tel:${s.phone}`}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                    >
                      <Phone size={13} /> {s.phone}
                    </a>
                    {s.email && (
                      <a
                        href={`mailto:${s.email}`}
                        className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                      >
                        <Mail size={13} /> {s.email}
                      </a>
                    )}
                  </div>
                </div>

                {sellerMachines.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
                    {sellerMachines.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)]"
                      >
                        {m.brand} {m.model} ({m.tonnage}T)
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            MODERATION_TONE[m.moderationStatus ?? "published"]
                          }`}
                        >
                          {MODERATION_LABELS[m.moderationStatus ?? "published"]}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
