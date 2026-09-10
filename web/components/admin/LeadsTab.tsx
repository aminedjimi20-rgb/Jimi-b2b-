"use client";

import { useMemo, useState } from "react";
import type { Lead, LeadType } from "@/lib/leads";
import type { PartCategory, PartCondition } from "@/lib/types";
import { wilayas } from "@/lib/wilayas";
import { Trash2, RefreshCw, MessageCircle, Phone, Mail, PackagePlus, CheckCircle2, X } from "lucide-react";

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

const CATEGORY_LABELS: Record<PartCategory, string> = {
  electrique: "Électrique",
  electronique: "Électronique",
  hydraulique: "Hydraulique",
  mecanique: "Mécanique",
  automatisme: "Automatisme",
  "plc-hmi": "PLC / HMI",
  variateurs: "Variateurs",
  "servo-moteurs": "Servo moteurs",
  moules: "Moules",
  autre: "Autre",
};

const CONDITION_LABELS: Record<PartCondition, string> = {
  neuf: "Neuve",
  occasion: "Occasion",
  renove: "Rénovée",
};

/** Une demande "Vente équipement" pour une pièce/moule ne collecte pas de
 *  catégorie précise (equipmentType n'en a que 4 : machine/piece/moule/autre).
 *  On ne peut déduire la vraie catégorie (électrique, hydraulique...) que
 *  pour moule/autre — pour "piece" l'admin doit la choisir lui-même. */
const EQUIPMENT_TYPE_DEFAULT_CATEGORY: Record<string, PartCategory | ""> = {
  moule: "moules",
  autre: "autre",
  piece: "",
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

interface ConvertForm {
  category: PartCategory | "";
  name: string;
  reference: string;
  condition: PartCondition;
  price: string;
  wilaya: string;
  description: string;
}

function buildConvertForm(lead: Lead): ConvertForm {
  const equipmentType = lead.data.equipmentType ?? "";
  return {
    category: EQUIPMENT_TYPE_DEFAULT_CATEGORY[equipmentType] ?? "",
    name: lead.data.reference ?? "",
    reference: lead.data.reference ?? "",
    condition: "occasion",
    price: lead.data.priceWanted ?? "",
    wilaya: lead.data.wilaya ?? "",
    description: lead.data.description ?? "",
  };
}

/** Une demande de vente pièce/moule/autre (pas les machines, qui passent déjà
 *  par le flux "Annonces à valider" via /api/listings) peut être transformée
 *  en fiche Pièce (brouillon) sans tout retaper. */
function isConvertibleSellLead(lead: Lead): boolean {
  return lead.type === "sell" && lead.data.equipmentType !== "machine";
}

export function LeadsTab({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [filterType, setFilterType] = useState<LeadType | "all">("all");
  const [loading, setLoading] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState<ConvertForm | null>(null);
  const [convertSaving, setConvertSaving] = useState(false);
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());

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

  function startConvert(lead: Lead) {
    setConvertingId(lead.id);
    setConvertForm(buildConvertForm(lead));
  }

  function cancelConvert() {
    setConvertingId(null);
    setConvertForm(null);
  }

  async function submitConvert(lead: Lead) {
    if (!convertForm || !convertForm.category || !convertForm.name.trim() || !convertForm.reference.trim()) {
      alert("Catégorie, nom et référence sont obligatoires.");
      return;
    }
    setConvertSaving(true);
    try {
      const res = await fetch("/api/admin/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: convertForm.category,
          name: convertForm.name.trim(),
          reference: convertForm.reference.trim(),
          condition: convertForm.condition,
          wilaya: convertForm.wilaya || undefined,
          description: convertForm.description,
          price: Number(convertForm.price) > 0 ? Number(convertForm.price) : null,
          priceOnRequest: !(Number(convertForm.price) > 0),
          photos: parsePhotos(lead.data.photos),
          status: "draft",
        }),
      });
      if (!res.ok) {
        alert("Erreur lors de la création de la fiche.");
        return;
      }
      setConvertedIds((prev) => new Set(prev).add(lead.id));
      await setStatus(lead.id, "closed");
      cancelConvert();
    } finally {
      setConvertSaving(false);
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

              {isConvertibleSellLead(lead) && (
                <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                  {convertedIds.has(lead.id) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={14} /> Fiche créée en brouillon — à publier depuis l&apos;onglet Pièces
                    </span>
                  ) : convertingId === lead.id && convertForm ? (
                    <div className="rounded-lg bg-[var(--color-surface-2)] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                          Créer une fiche pièce (brouillon)
                        </p>
                        <button
                          onClick={cancelConvert}
                          className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-white"
                          aria-label="Annuler"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <select
                          value={convertForm.category}
                          onChange={(e) =>
                            setConvertForm((f) => f && { ...f, category: e.target.value as PartCategory })
                          }
                          className="admin-input"
                        >
                          <option value="">Choisir une catégorie...</option>
                          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={convertForm.condition}
                          onChange={(e) =>
                            setConvertForm((f) => f && { ...f, condition: e.target.value as PartCondition })
                          }
                          className="admin-input"
                        >
                          {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          value={convertForm.name}
                          onChange={(e) => setConvertForm((f) => f && { ...f, name: e.target.value })}
                          placeholder="Nom de la pièce"
                          className="admin-input"
                        />
                        <input
                          value={convertForm.reference}
                          onChange={(e) => setConvertForm((f) => f && { ...f, reference: e.target.value })}
                          placeholder="Référence"
                          className="admin-input"
                        />
                        <input
                          type="number"
                          value={convertForm.price}
                          onChange={(e) => setConvertForm((f) => f && { ...f, price: e.target.value })}
                          placeholder="Prix (DA) — vide = sur demande"
                          className="admin-input"
                        />
                        <select
                          value={convertForm.wilaya}
                          onChange={(e) => setConvertForm((f) => f && { ...f, wilaya: e.target.value })}
                          className="admin-input"
                        >
                          <option value="">Wilaya —</option>
                          {wilayas.map((w) => (
                            <option key={w.code} value={w.fr}>
                              {w.fr}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={convertForm.description}
                          onChange={(e) => setConvertForm((f) => f && { ...f, description: e.target.value })}
                          placeholder="Description"
                          rows={2}
                          className="admin-input sm:col-span-2"
                        />
                      </div>
                      <button
                        onClick={() => submitConvert(lead)}
                        disabled={convertSaving}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <PackagePlus size={14} />
                        {convertSaving ? "Création..." : "Créer la fiche (brouillon)"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startConvert(lead)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      <PackagePlus size={14} /> Créer la fiche pièce à partir de cette demande
                    </button>
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
