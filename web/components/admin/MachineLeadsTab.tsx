"use client";

import { useState, FormEvent } from "react";
import type { MachineLead, LeadStatus, CommissionType, CommissionStatus } from "@/lib/machineLeads";
import type { SellerProfile } from "@/lib/sellers";
import type { BuyerProfile } from "@/lib/buyers";
import { RefreshCw, MessageCircle, Phone, Mail, Trash2, Clock } from "lucide-react";

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  visit_scheduled: "Visite planifiée",
  negotiation: "Négociation",
  sold: "Vendu",
  lost: "Perdu",
};

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "bg-blue-50 text-blue-700",
  contacted: "bg-slate-100 text-slate-700",
  qualified: "bg-teal-50 text-teal-700",
  visit_scheduled: "bg-purple-50 text-purple-700",
  negotiation: "bg-amber-50 text-amber-700",
  sold: "bg-emerald-50 text-emerald-700",
  lost: "bg-red-50 text-red-700",
};

const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  percentage: "Pourcentage",
  fixed: "Montant fixe",
};

const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: "En attente",
  agreed: "Convenue",
  paid: "Payée",
};

export function MachineLeadsTab({
  initialLeads,
  sellers,
  buyers,
}: {
  initialLeads: MachineLead[];
  sellers: SellerProfile[];
  buyers: BuyerProfile[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [loading, setLoading] = useState(false);
  const sellerById = new Map(sellers.map((s) => [s.id, s]));
  const buyerById = new Map(buyers.map((b) => [b.id, b]));

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/machine-leads");
      const json = await res.json();
      setLeads(json.leads ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch("/api/admin/machine-leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) {
      const json = await res.json();
      const updated = json.lead as MachineLead;
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    }
  }

  function setStatus(id: string, status: LeadStatus) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    patch(id, { status });
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement ce lead ?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/admin/machine-leads?id=${id}`, { method: "DELETE" });
  }

  async function saveCommission(id: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await patch(id, {
      adminNote: String(formData.get("adminNote") || "") || null,
      commission: {
        type: String(formData.get("commissionType") || "percentage"),
        value: Number(formData.get("commissionValue") || 0),
        expectedAmount: formData.get("expectedAmount") ? Number(formData.get("expectedAmount")) : null,
        status: String(formData.get("commissionStatus") || "pending"),
      },
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Chaque lead relie un acheteur, une machine et son vendeur. Coordonnées privées, jamais
          partagées automatiquement entre les deux parties.
        </p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      {leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-text-muted)]">
          Aucun lead pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {leads.map((l) => {
            const buyer = buyerById.get(l.buyerId);
            const seller = l.sellerId ? sellerById.get(l.sellerId) : null;
            return (
              <div key={l.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[l.status]}`}>
                      {STATUS_LABELS[l.status]}
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-ink)]">{l.machineLabel}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Clock size={12} /> {new Date(l.createdAt).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={l.status}
                      onChange={(e) => setStatus(l.id, e.target.value as LeadStatus)}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium"
                    >
                      {Object.entries(STATUS_LABELS).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => remove(l.id)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-[var(--color-surface-2)] p-3">
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Acheteur
                    </p>
                    {buyer ? (
                      <>
                        <p className="text-sm font-semibold text-[var(--color-ink)]">
                          {buyer.name} {buyer.company && `— ${buyer.company}`}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                          <a
                            href={`https://wa.me/${(buyer.whatsapp || buyer.phone).replace(/[^\d]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#1fa855] hover:underline"
                          >
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                          <a
                            href={`tel:${buyer.phone}`}
                            className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                          >
                            <Phone size={13} /> {buyer.phone}
                          </a>
                          {buyer.email && (
                            <a
                              href={`mailto:${buyer.email}`}
                              className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                            >
                              <Mail size={13} /> {buyer.email}
                            </a>
                          )}
                        </div>
                        {l.message && (
                          <p className="mt-2 whitespace-pre-line text-xs text-[var(--color-text)]">
                            &laquo; {l.message} &raquo;
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">Profil introuvable</p>
                    )}
                  </div>

                  <div className="rounded-lg bg-[var(--color-surface-2)] p-3">
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Vendeur
                    </p>
                    {seller ? (
                      <>
                        <p className="text-sm font-semibold text-[var(--color-ink)]">
                          {seller.name} {seller.company && `— ${seller.company}`}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                          <a
                            href={`https://wa.me/${(seller.whatsapp || seller.phone).replace(/[^\d]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#1fa855] hover:underline"
                          >
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                          <a
                            href={`tel:${seller.phone}`}
                            className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                          >
                            <Phone size={13} /> {seller.phone}
                          </a>
                          {seller.email && (
                            <a
                              href={`mailto:${seller.email}`}
                              className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                            >
                              <Mail size={13} /> {seller.email}
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Machine ajoutée directement par JIMI Industrie (pas de fiche vendeur)
                      </p>
                    )}
                  </div>
                </div>

                <form
                  onSubmit={(e) => saveCommission(l.id, e)}
                  className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-dashed border-[var(--color-border)] p-3 sm:grid-cols-5"
                >
                  <p className="col-span-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)] sm:col-span-5">
                    Commission (usage interne uniquement)
                  </p>
                  <select name="commissionType" defaultValue={l.commission.type} className="admin-input text-xs">
                    {Object.entries(COMMISSION_TYPE_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    name="commissionValue"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={l.commission.value}
                    placeholder="Valeur"
                    className="admin-input text-xs"
                  />
                  <input
                    name="expectedAmount"
                    type="number"
                    min={0}
                    defaultValue={l.commission.expectedAmount ?? ""}
                    placeholder="Montant attendu (DA)"
                    className="admin-input text-xs"
                  />
                  <select
                    name="commissionStatus"
                    defaultValue={l.commission.status}
                    className="admin-input text-xs"
                  >
                    {Object.entries(COMMISSION_STATUS_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1b262f]"
                  >
                    Enregistrer
                  </button>
                  <textarea
                    name="adminNote"
                    defaultValue={l.adminNote ?? ""}
                    placeholder="Note interne (négociation, visite, etc.)"
                    rows={2}
                    className="admin-input col-span-2 text-xs sm:col-span-5"
                  />
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
