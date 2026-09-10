"use client";

import { useState, FormEvent } from "react";
import type { Part, PartCategory, PartCondition, PartStatus } from "@/lib/types";
import { PhotoUploader } from "@/components/forms/MediaUploader";
import { Plus, Trash2, Lock, RefreshCw, EyeOff, Eye, Tag } from "lucide-react";

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
};

const CONDITION_LABELS: Record<PartCondition, string> = {
  neuf: "Neuve",
  occasion: "Occasion",
  renove: "Rénovée",
};

const STATUS_LABELS: Record<PartStatus, string> = {
  draft: "Brouillon (masquée)",
  published: "Publiée",
};

export function PartsTab({ initialParts }: { initialParts: Part[] }) {
  const [parts, setParts] = useState(initialParts);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/parts");
      const json = await res.json();
      setParts(json.parts ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/admin/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          priceOnRequest: formData.get("priceOnRequest") === "on",
          photos: newPhotos,
        }),
      });
      if (res.ok) {
        e.currentTarget.reset();
        setNewPhotos([]);
        setShowForm(false);
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(id: string, status: PartStatus) {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    await fetch(`/api/admin/parts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function setPromo(id: string, isPromo: boolean) {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, isPromo } : p)));
    await fetch(`/api/admin/parts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPromo }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cette pièce ?")) return;
    setParts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/admin/parts/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Catalogue des pièces industrielles affichées sur <strong>/pieces-industrielles</strong>.
          Une pièce ajoutée ici avec le statut <strong>Publiée</strong> apparaît immédiatement dans
          sa catégorie sur le site public.
        </p>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b58ad]"
          >
            <Plus size={14} /> Ajouter une pièce
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5 sm:grid-cols-3"
        >
          <select name="category" defaultValue="electronique" className="admin-input">
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input name="name" required placeholder="Nom de la pièce" className="admin-input" />
          <input name="reference" required placeholder="Référence" className="admin-input" />
          <select name="condition" defaultValue="occasion" className="admin-input">
            {Object.entries(CONDITION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select name="status" defaultValue="published" className="admin-input">
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input name="price" type="number" placeholder="Prix (DA)" className="admin-input" />
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" name="priceOnRequest" /> Prix sur demande
          </label>
          <textarea
            name="description"
            placeholder="Description"
            rows={3}
            className="admin-input sm:col-span-3"
          />

          <div className="sm:col-span-3">
            <p className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              Photos (optionnel)
            </p>
            <PhotoUploader value={newPhotos} onChange={setNewPhotos} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b262f] sm:col-span-3"
          >
            {submitting ? "Ajout en cours..." : "Ajouter la pièce"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-start text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-4 py-3 text-start">Pièce</th>
              <th className="px-4 py-3 text-start">Référence</th>
              <th className="px-4 py-3 text-start">Catégorie</th>
              <th className="px-4 py-3 text-start">État</th>
              <th className="px-4 py-3 text-start">Statut</th>
              <th className="px-4 py-3 text-start">Promo</th>
              <th className="px-4 py-3 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{p.name}</td>
                <td className="px-4 py-3">{p.reference}</td>
                <td className="px-4 py-3">{CATEGORY_LABELS[p.category]}</td>
                <td className="px-4 py-3">{CONDITION_LABELS[p.condition]}</td>
                <td className="px-4 py-3">
                  {p.isDemo ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {STATUS_LABELS[p.status]}
                    </span>
                  ) : (
                    <select
                      value={p.status}
                      onChange={(e) => setStatus(p.id, e.target.value as PartStatus)}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium"
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.isDemo ? (
                    p.isPromo ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
                        <Tag size={13} /> Promo
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )
                  ) : (
                    <button
                      onClick={() => setPromo(p.id, !p.isPromo)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.isPromo
                          ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      <Tag size={12} /> {p.isPromo ? "Promo" : "—"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-end">
                  {!p.isDemo && (
                    <div className="flex items-center justify-end gap-1">
                      {p.status === "published" && (
                        <button
                          onClick={() => setStatus(p.id, "draft")}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                          aria-label="Masquer du site public"
                          title="Masquer du site public"
                        >
                          <EyeOff size={15} />
                        </button>
                      )}
                      {p.status === "draft" && (
                        <button
                          onClick={() => setStatus(p.id, "published")}
                          className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                          aria-label="Republier"
                          title="Republier sur le site public"
                        >
                          <Eye size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => remove(p.id)}
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                  {p.isDemo && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Lock size={11} /> Démo
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
