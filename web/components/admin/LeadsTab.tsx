"use client";

import { useMemo, useState } from "react";
import type { Lead, LeadType } from "@/lib/leads";
import { Trash2, RefreshCw, MessageCircle, Phone, Mail } from "lucide-react";

const TYPE_LABELS: Record<LeadType, string> = {
  buy: "Recherche machine",
  sell: "Vente équipement",
  service: "Demande de service",
  contact: "Contact",
};

const TYPE_TONE: Record<LeadType, string> = {
  buy: "bg-blue-50 text-blue-700",
  sell: "bg-teal-50 text-teal-700",
  service: "bg-amber-50 text-amber-700",
  contact: "bg-slate-100 text-slate-700",
};

const STATUS_LABELS: Record<Lead["status"], string> = {
  new: "Nouveau",
  contacted: "Contacté",
  closed: "Clôturé",
};

/** The "Vendre un équipement" form (pièce/moule) stores its photos as a JSON
 *  array string in lead.data.photos — parse it back for a thumbnail preview
 *  instead of dumping raw JSON in the generic key/value list below. */
function parsePhotos(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function LeadsTab({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [filterType, setFilterType] = useState<LeadType | "all">("all");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(
    () => (filterType === "all" ? leads : leads.filter((l) => l.type === filterType)),
    [leads, filterType]
  );

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/leads");
      const json = await res.json();
      setLeads(json.leads ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: Lead["status"]) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cette demande ?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/admin/leads?id=${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "buy", "sell", "service", "contact"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filterType === type
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-white text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]"
              }`}
            >
              {type === "all" ? "Toutes" : TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-text-muted)]">
          Aucune demande pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((lead) => (
            <div
              key={lead.id}
              className="rounded-xl border border-[var(--color-border)] bg-white p-4 md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TYPE_TONE[lead.type]}`}>
                    {TYPE_LABELS[lead.type]}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {new Date(lead.createdAt).toLocaleString("fr-FR")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={lead.status}
                    onChange={(e) => setStatus(lead.id, e.target.value as Lead["status"])}
                    className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(lead.id)}
                    className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {Object.entries(lead.data)
                  .filter(([key]) => key !== "photos")
                  .map(([key, value]) => (
                    <div key={key} className="flex gap-1.5">
                      <span className="shrink-0 font-medium text-[var(--color-text-muted)]">{key}:</span>
                      <span className="text-[var(--color-text)]">{value}</span>
                    </div>
                  ))}
              </div>

              {parsePhotos(lead.data.photos).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {parsePhotos(lead.data.photos).map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- photos live on a user-configured Cloudinary domain, unknown at build time */}
                      <img
                        src={url}
                        alt={`Photo ${i + 1}`}
                        className="h-16 w-16 rounded-md border border-[var(--color-border)] object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}

              {(lead.data.phone || lead.data.email) && (
                <div className="mt-3 flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-3">
                  {lead.data.phone && (
                    <>
                      <a
                        href={`https://wa.me/${lead.data.phone.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1fa855] hover:underline"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                      <a
                        href={`tel:${lead.data.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                      >
                        <Phone size={13} /> Appeler
                      </a>
                    </>
                  )}
                  {lead.data.email && (
                    <a
                      href={`mailto:${lead.data.email}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                    >
                      <Mail size={13} /> Email
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
