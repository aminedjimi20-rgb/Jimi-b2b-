"use client";

import { useState, FormEvent, Fragment } from "react";
import type { Machine, MachineDrive, MachineStatus } from "@/lib/types";
import { PhotoUploader, VideoUploader } from "@/components/forms/MediaUploader";
import { Plus, Trash2, Lock, RefreshCw, Video, Pencil, X, Check, EyeOff, Eye, Tag } from "lucide-react";

const STATUS_LABELS: Record<MachineStatus, string> = {
  draft: "Brouillon (masquée)",
  pending: "En attente de validation",
  published: "Publiée",
  rejected: "Rejetée",
  reserved: "Réservée",
  sold: "Vendue",
};

const STATUS_TONE: Record<MachineStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  reserved: "bg-purple-50 text-purple-700",
  sold: "bg-blue-50 text-blue-700",
};

const DRIVE_LABELS: Record<MachineDrive, string> = {
  hydraulique: "Hydraulique",
  servo: "Servo",
  hybride: "Hybride",
};

export function MachinesTab({ initialMachines }: { initialMachines: Machine[] }) {
  const [machines, setMachines] = useState(initialMachines);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingVideoUrl, setEditingVideoUrl] = useState<string | null>(null);
  const [savingVideo, setSavingVideo] = useState(false);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  const [newVideo, setNewVideo] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/machines");
      const json = await res.json();
      setMachines(json.machines ?? []);
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
      const res = await fetch("/api/admin/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          priceOnRequest: formData.get("priceOnRequest") === "on",
          photos: newPhotos,
          videoUrl: newVideo,
        }),
      });
      if (res.ok) {
        e.currentTarget.reset();
        setNewPhotos([]);
        setNewVideo(null);
        setShowForm(false);
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(id: string, status: MachineStatus) {
    setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    await fetch(`/api/admin/machines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function setPromo(id: string, isPromo: boolean) {
    setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, isPromo } : m)));
    await fetch(`/api/admin/machines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPromo }),
    });
  }

  async function saveVideo(id: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingVideo(true);
    const formData = new FormData(e.currentTarget);
    const videoTitle = String(formData.get("videoTitle") || "");
    try {
      const res = await fetch(`/api/admin/machines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: editingVideoUrl,
          videoTitle: videoTitle || null,
        }),
      });
      if (res.ok) {
        setEditingVideoId(null);
        await refresh();
      }
    } finally {
      setSavingVideo(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cette machine ?")) return;
    setMachines((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/admin/machines/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Les machines <strong>« Démo »</strong> proviennent des données d&apos;exemple du site
          (non modifiables ici). Les machines ajoutées par les vendeurs sont soumises à
          validation : elles apparaissent sur le site public uniquement après approbation de
          Jimi (onglet « Annonces à valider »). Une machine ajoutée directement ici par un admin
          est publiée immédiatement.
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
            <Plus size={14} /> Ajouter une machine
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5 sm:grid-cols-3"
        >
          <input name="brand" required placeholder="Marque" className="admin-input" />
          <input name="model" required placeholder="Modèle" className="admin-input" />
          <input name="tonnage" type="number" required placeholder="Tonnage" className="admin-input" />
          <input name="year" type="number" required placeholder="Année" className="admin-input" />
          <select name="drive" defaultValue="hydraulique" className="admin-input">
            {Object.entries(DRIVE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select name="status" defaultValue="published" className="admin-input">
            {(["published", "draft", "reserved", "sold"] as MachineStatus[]).map((v) => (
              <option key={v} value={v}>
                {STATUS_LABELS[v]}
              </option>
            ))}
          </select>
          <input name="wilaya" placeholder="Wilaya" className="admin-input" />
          <input name="price" type="number" placeholder="Prix (DA)" className="admin-input" />
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" name="priceOnRequest" /> Prix sur demande
          </label>
          <textarea
            name="description"
            placeholder="Description technique"
            rows={3}
            className="admin-input sm:col-span-3"
          />

          <div className="sm:col-span-3">
            <p className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              Photos (optionnel)
            </p>
            <PhotoUploader value={newPhotos} onChange={setNewPhotos} />
          </div>

          <div className="sm:col-span-3">
            <p className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              Vidéo de la machine (optionnel)
            </p>
            <VideoUploader value={newVideo} onChange={setNewVideo} />
          </div>
          <input
            name="videoTitle"
            placeholder="Titre de la vidéo (optionnel)"
            className="admin-input sm:col-span-3"
          />

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b262f] sm:col-span-3"
          >
            {submitting ? "Ajout en cours..." : "Ajouter la machine"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-start text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-4 py-3 text-start">Machine</th>
              <th className="px-4 py-3 text-start">Tonnage</th>
              <th className="px-4 py-3 text-start">Wilaya</th>
              <th className="px-4 py-3 text-start">Statut</th>
              <th className="px-4 py-3 text-start">Promo</th>
              <th className="px-4 py-3 text-start">Vidéo</th>
              <th className="px-4 py-3 text-start">Source</th>
              <th className="px-4 py-3 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <Fragment key={m.id}>
                <tr className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                    {m.brand} {m.model}
                  </td>
                  <td className="px-4 py-3">{m.tonnage} T</td>
                  <td className="px-4 py-3">{m.wilaya}</td>
                  <td className="px-4 py-3">
                    {m.isDemo ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[m.status]}`}>
                        {STATUS_LABELS[m.status]}
                      </span>
                    ) : (
                      <select
                        value={m.status}
                        onChange={(e) => setStatus(m.id, e.target.value as MachineStatus)}
                        className={`rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium ${STATUS_TONE[m.status]}`}
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
                    {m.isDemo ? (
                      m.isPromo ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
                          <Tag size={13} /> Promo
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )
                    ) : (
                      <button
                        onClick={() => setPromo(m.id, !m.isPromo)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          m.isPromo
                            ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        <Tag size={12} /> {m.isPromo ? "Promo" : "—"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.videoUrl ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <Video size={13} /> Oui
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {m.isDemo ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <Lock size={11} /> Démo
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600">Réelle</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {!m.isDemo && (
                      <div className="flex items-center justify-end gap-1">
                        {m.status === "published" && (
                          <button
                            onClick={() => setStatus(m.id, "draft")}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                            aria-label="Masquer du site public"
                            title="Masquer du site public"
                          >
                            <EyeOff size={15} />
                          </button>
                        )}
                        {m.status === "draft" && (
                          <button
                            onClick={() => setStatus(m.id, "published")}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                            aria-label="Republier"
                            title="Republier sur le site public"
                          >
                            <Eye size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (editingVideoId === m.id) {
                              setEditingVideoId(null);
                            } else {
                              setEditingVideoId(m.id);
                              setEditingVideoUrl(m.videoUrl ?? null);
                            }
                          }}
                          className="rounded-md p-1.5 text-[var(--color-accent)] hover:bg-blue-50"
                          aria-label="Modifier"
                        >
                          {editingVideoId === m.id ? <X size={15} /> : <Pencil size={15} />}
                        </button>
                        <button
                          onClick={() => remove(m.id)}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {editingVideoId === m.id && (
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                    <td colSpan={8} className="px-4 py-4">
                      <form
                        onSubmit={(e) => saveVideo(m.id, e)}
                        className="flex flex-col gap-3 sm:max-w-md"
                      >
                        <VideoUploader value={editingVideoUrl} onChange={setEditingVideoUrl} />
                        <input
                          name="videoTitle"
                          defaultValue={m.videoTitle ?? ""}
                          placeholder="Titre de la vidéo"
                          className="admin-input"
                        />
                        <button
                          type="submit"
                          disabled={savingVideo}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b58ad]"
                        >
                          <Check size={15} />
                          {savingVideo ? "Enregistrement..." : "Enregistrer la vidéo"}
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
