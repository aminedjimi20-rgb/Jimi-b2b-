"use client";

import { useState, FormEvent, Fragment } from "react";
import type { Project, ProjectStatus, ProjectInterventionType } from "@/lib/types";
import { PhotoUploader, VideoUploader } from "@/components/forms/MediaUploader";
import { Plus, Trash2, Lock, RefreshCw, Video, Pencil, X, Check, EyeOff, Eye } from "lucide-react";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Brouillon (masquée)",
  published: "Publiée",
};

const INTERVENTION_TYPE_LABELS: Record<ProjectInterventionType, string> = {
  renovation: "Rénovation",
  automatisation: "Automatisation",
  reparation: "Réparation",
  retrofit: "Retrofit",
  installation: "Installation",
  "mise-en-service": "Mise en service",
};

const STATUS_TONE: Record<ProjectStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-emerald-50 text-emerald-700",
};

export function ProjectsTab({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects);
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
      const res = await fetch("/api/admin/projects");
      const json = await res.json();
      setProjects(json.projects ?? []);
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
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, photos: newPhotos, videoUrl: newVideo }),
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

  async function setStatus(id: string, status: ProjectStatus) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    await fetch(`/api/admin/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function saveVideo(id: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingVideo(true);
    const formData = new FormData(e.currentTarget);
    const videoTitle = String(formData.get("videoTitle") || "");
    try {
      const res = await fetch(`/api/admin/projects/${id}`, {
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
    if (!confirm("Supprimer définitivement cette réalisation ?")) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/admin/projects/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Les réalisations affichées sur <strong>/realisations</strong> et sur la page d&apos;accueil.
          Une réalisation avec le statut <strong>Publiée</strong> apparaît immédiatement sur le site
          public, avec sa vidéo si vous en ajoutez une.
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
            <Plus size={14} /> Ajouter une réalisation
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5 sm:grid-cols-3"
        >
          <input name="title" required placeholder="Titre du projet" className="admin-input sm:col-span-2" />
          <select name="status" defaultValue="published" className="admin-input">
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input name="brand" required placeholder="Marque" className="admin-input" />
          <input name="tonnage" type="number" required placeholder="Tonnage" className="admin-input" />
          <select name="interventionType" defaultValue="" className="admin-input">
            <option value="">Type d&apos;intervention (optionnel)</option>
            {Object.entries(INTERVENTION_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <textarea
            name="problem"
            required
            placeholder="Problème initial"
            rows={2}
            className="admin-input sm:col-span-3"
          />
          <textarea
            name="solution"
            required
            placeholder="Solution apportée"
            rows={2}
            className="admin-input sm:col-span-3"
          />
          <textarea name="result" required placeholder="Résultat" rows={2} className="admin-input sm:col-span-3" />

          <div className="sm:col-span-3">
            <p className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              Photos (optionnel)
            </p>
            <PhotoUploader value={newPhotos} onChange={setNewPhotos} />
          </div>

          <div className="sm:col-span-3">
            <p className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              Vidéo (optionnel)
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
            {submitting ? "Ajout en cours..." : "Ajouter la réalisation"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-start text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-4 py-3 text-start">Réalisation</th>
              <th className="px-4 py-3 text-start">Marque</th>
              <th className="px-4 py-3 text-start">Statut</th>
              <th className="px-4 py-3 text-start">Vidéo</th>
              <th className="px-4 py-3 text-start">Source</th>
              <th className="px-4 py-3 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{p.title}</td>
                  <td className="px-4 py-3">
                    {p.brand} — {p.tonnage} T
                  </td>
                  <td className="px-4 py-3">
                    {p.isDemo ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    ) : (
                      <select
                        value={p.status}
                        onChange={(e) => setStatus(p.id, e.target.value as ProjectStatus)}
                        className={`rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium ${STATUS_TONE[p.status]}`}
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
                    {p.videoUrl ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <Video size={13} /> Oui
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.isDemo ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <Lock size={11} /> Démo
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600">Réelle</span>
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
                          onClick={() => {
                            if (editingVideoId === p.id) {
                              setEditingVideoId(null);
                            } else {
                              setEditingVideoId(p.id);
                              setEditingVideoUrl(p.videoUrl ?? null);
                            }
                          }}
                          className="rounded-md p-1.5 text-[var(--color-accent)] hover:bg-blue-50"
                          aria-label="Modifier la vidéo"
                        >
                          {editingVideoId === p.id ? <X size={15} /> : <Pencil size={15} />}
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {editingVideoId === p.id && (
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                    <td colSpan={6} className="px-4 py-4">
                      <form
                        onSubmit={(e) => saveVideo(p.id, e)}
                        className="flex flex-col gap-3 sm:max-w-md"
                      >
                        <VideoUploader value={editingVideoUrl} onChange={setEditingVideoUrl} />
                        <input
                          name="videoTitle"
                          defaultValue={p.videoTitle ?? ""}
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
