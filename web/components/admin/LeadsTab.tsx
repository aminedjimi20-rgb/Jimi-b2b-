"use client";

import { useMemo, useState } from "react";
import type { Lead, LeadType } from "@/lib/leads";
import type { PartCategory } from "@/lib/types";
import { Trash2, RefreshCw, MessageCircle, Phone, Mail, Check, CheckCircle2 } from "lucide-react";

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

/** Une demande "Vente équipement" pour une pièce/moule ne collecte pas de
 *  catégorie précise (equipmentType n'en a que 4 : machine/piece/moule/autre).
 *  "autre" sert de catégorie de repli pour "piece" — l'admin la recatégorise
 *  ensuite depuis l'onglet Pièces si besoin, plutôt que de bloquer sur un
 *  choix au moment d'accepter la demande. */
const EQUIPMENT_TYPE_TO_CATEGORY: Record<string, PartCategory> = {
  moule: "moules",
  autre: "autre",
  piece: "autre",
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

/** Une demande de vente pièce/moule/autre (pas les machines, qui passent déjà
 *  par le flux "Annonces à valider" via /api/listings) peut être acceptée
 *  directement en fiche Pièce (brouillon), à compléter depuis l'onglet Pièces. */
function isAcceptableSellLead(lead: Lead): boolean {
  return lead.type === "sell" && lead.data.equipmentType !== "machine";
}

/** Une demande "Recherche machine" (achat) peut être acceptée pour
 *  enregistrer l'acheteur dans l'onglet Acheteurs, plutôt que de laisser
 *  son contact perdu dans le texte brut de la demande. */
function isAcceptableBuyLead(lead: Lead): boolean {
  return lead.type === "buy";
}

function isAcceptableLead(lead: Lead): boolean {
  return isAcceptableSellLead(lead) || isAcceptableBuyLead(lead);
}

export function LeadsTab({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [filterType, setFilterType] = useState<LeadType | "all">("all");
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

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

/** Enregistre le contact de la demande (nom/téléphone obligatoires) dans
   *  Vendeurs ou Acheteurs selon le type, pour qu'il ne reste pas perdu dans
   *  le texte brut de la demande. findOrCreateSeller/Buyer dédoublonne par
   *  téléphone côté serveur, donc accepter la même personne deux fois ne
   *  crée pas deux fiches. */
  async function registerContact(lead: Lead, endpoint: "sellers" | "buyers"): Promise<boolean> {
    if (!lead.data.name || !lead.data.phone) return true; // rien à enregistrer, pas bloquant
    const res = await fetch(`/api/admin/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: lead.data.name,
        phone: lead.data.phone,
        whatsapp: lead.data.whatsapp || undefined,
        wilaya: lead.data.wilaya || undefined,
      }),
    });
    return res.ok;
  }

  async function accept(lead: Lead) {
    setAcceptingId(lead.id);
    try {
      if (isAcceptableSellLead(lead)) {
        const priceWanted = Number(lead.data.priceWanted);
        const nameOrRef = lead.data.reference?.trim() || lead.data.description?.trim() || "Pièce à identifier";
        const [partRes, sellerOk] = await Promise.all([
          fetch("/api/admin/parts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: EQUIPMENT_TYPE_TO_CATEGORY[lead.data.equipmentType ?? ""] ?? "autre",
              name: nameOrRef,
              reference: nameOrRef,
              condition: "occasion",
              wilaya: lead.data.wilaya || undefined,
              description: lead.data.description ?? "",
              price: priceWanted > 0 ? priceWanted : null,
              priceOnRequest: !(priceWanted > 0),
              photos: parsePhotos(lead.data.photos),
              status: "draft",
            }),
          }),
          registerContact(lead, "sellers"),
        ]);
        if (!partRes.ok) {
          alert("Erreur lors de la création de la fiche.");
          return;
        }
        if (!sellerOk) {
          alert("Fiche créée, mais l'enregistrement du vendeur a échoué — à ajouter manuellement dans Vendeurs.");
        }
      } else if (isAcceptableBuyLead(lead)) {
        const buyerOk = await registerContact(lead, "buyers");
        if (!buyerOk) {
          alert("Erreur lors de l'enregistrement de l'acheteur.");
          return;
        }
      }
      setAcceptedIds((prev) => new Set(prev).add(lead.id));
      await setStatus(lead.id, "closed");
    } finally {
      setAcceptingId(null);
    }
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
                  {isAcceptableLead(lead) && !acceptedIds.has(lead.id) && (
                    <button
                      onClick={() => accept(lead)}
                      disabled={acceptingId === lead.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Check size={14} />
                      {acceptingId === lead.id ? "..." : "Accepter"}
                    </button>
                  )}
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

              {acceptedIds.has(lead.id) && (
                <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={14} />
                    {isAcceptableSellLead(lead)
                      ? "Fiche créée en brouillon (à publier depuis l'onglet Pièces) et vendeur enregistré dans Vendeurs"
                      : "Acheteur enregistré dans l'onglet Acheteurs"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
