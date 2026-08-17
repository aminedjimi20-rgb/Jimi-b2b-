"use client";

import { useState } from "react";
import type { BuyerProfile } from "@/lib/buyers";
import type { MachineLead } from "@/lib/machineLeads";
import { RefreshCw, MessageCircle, Phone, Mail } from "lucide-react";

export function BuyersTab({
  initialBuyers,
  leads,
}: {
  initialBuyers: BuyerProfile[];
  leads: MachineLead[];
}) {
  const [buyers, setBuyers] = useState(initialBuyers);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/buyers");
      const json = await res.json();
      setBuyers(json.buyers ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Coordonnées privées des acheteurs — <strong>jamais visibles par le vendeur</strong>.
        </p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      {buyers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-text-muted)]">
          Aucun acheteur pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {buyers.map((b) => {
            const buyerLeads = leads.filter((l) => l.buyerId === b.id);
            return (
              <div key={b.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[var(--color-ink)]">
                      {b.name} {b.company && <span className="font-normal text-[var(--color-text-muted)]">— {b.company}</span>}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {b.wilaya || "—"} · Inscrit le {new Date(b.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <a
                      href={`https://wa.me/${(b.whatsapp || b.phone).replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#1fa855] hover:underline"
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                    <a
                      href={`tel:${b.phone}`}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                    >
                      <Phone size={13} /> {b.phone}
                    </a>
                    {b.email && (
                      <a
                        href={`mailto:${b.email}`}
                        className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                      >
                        <Mail size={13} /> {b.email}
                      </a>
                    )}
                  </div>
                </div>

                {buyerLeads.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
                    {buyerLeads.map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)]"
                      >
                        {l.machineLabel}
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
