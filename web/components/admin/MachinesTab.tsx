"use client";

import { useMemo, useState, FormEvent, Fragment } from "react";
import type { Machine, MachineDrive, MachineStatus, MachineCondition, MachineSpecs } from "@/lib/types";
import { PhotoUploader, VideoUploader } from "@/components/forms/MediaUploader";
import {
  Plus,
  Trash2,
  Lock,
  RefreshCw,
  Video,
  Pencil,
  X,
  Check,
  EyeOff,
  Eye,
  Tag,
  Search,
} from "lucide-react";

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

const CONDITION_LABELS: Record<MachineCondition, string> = {
  neuf: "Neuve",
  occasion: "Occasion",
  renove: "Reconditionnée",
};

const SPEC_FIELDS: { key: keyof MachineSpecs; label: string }[] = [
  { key: "clampingForce", label: "Force de fermeture" },
  { key: "screwDiameter", label: "Diamètre vis" },
  { key: "injectionVolume", label: "Volume d'injection" },
  { key: "injectionPressure", label: "Pression d'injection" },
  { key: "motor", label: "Moteur" },
  { key: "control", label: "Commande" },
  { key: "plc", label: "PLC" },
  { key: "hmi", label: "HMI" },
  { key: "pumpType", label: "Type de pompe" },
  { key: "hours", label: "Heures de fonctionnement" },
];

export function MachinesTab({ initialMachines }: { initialMachines: Machine[] }) {
  const [machines, setMachines] = useState(initialMachines);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingVideoUrl, setEditingVideoUrl] = useState<string | null>(null);
  const [savingVideo, setSavingVideo] = useState(false);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  const [newVideo, setNewVideo] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<MachineStatus | "all">("all");
  const [filterDrive, setFilterDrive] = useState<MachineDrive | "all">("all");

  const editingMachine = editingId ? machines.find((m) => m.id === editingId) ?? null : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return machines.filter((m) => {
      if (filterStatus !== "all" && m.status !== filterStatus) return false;
      if (filterDrive !== "all" && m.drive !== filterDrive) return false;
      if (!q) return true;
      return (
        m.brand.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        (m.reference ?? "").toLowerCase().includes(q) ||
        m.wilaya.toLowerCase().includes(q)
      );
    });
  }, [machines, search, filterStatus, filterDrive]);

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

  function startAdd() {
    setEditingId(null);
    setNewPhotos([]);
    setNewVideo(null);
    setShowForm(true);
  }

  function startEdit(m: Machine) {
    setEditingId(m.id);
    setNewPhotos(m.photos ?? []);
    setNewVideo(m.videoUrl ?? null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setNewPhotos([]);
    setNewVideo(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const specs: MachineSpecs = {};
    for (const { key } of SPEC_FIELDS) {
      const value = formData.get(`spec_${key}`);
      if (typeof value === "string" && value.trim()) specs[key] = value.trim();
    }
    for (const { key } of SPEC_FIELDS) {
      delete (payload as Record<string, unknown>)[`spec_${key}`];
    }

    const body = {
      ...payload,
      priceOnRequest: formData.get("priceOnRequest") === "on",
      photos: newPhotos,
      videoUrl: newVideo,
      specs,
      worksPerformed: String(formData.get("worksPerformed") || "").split("\n"),
      defects: String(formData.get("defects") || "").split("\n"),
      accessories: String(formData.get("accessories") || "").split("\n"),
    };

    try {
      const res = await fetch(
        editingId ? `/api/admin/machines/${editingId}` : "/api/admin/machines",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        cancelForm();
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
          JIMI Industrie (onglet « Annonces à valider »). Une machine ajoutée directement ici par un admin
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
            onClick={() => (showForm && !editingId ? cancelForm() : startAdd())}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b58ad]"
          >
            <Plus size={14} /> Ajouter une machine
          </button>
        </div>
      </div>

      {showForm && (
        <form
          key={editingId ?? "new"}
          onSubmit={onSubmit}
          className="mb-6 flex flex-col gap-5 rounded-xl border border-[var(--color-border)] bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--color-ink)]">
              {editingMachine
                ? `Modifier : ${editingMachine.brand} ${editingMachine.model}`
                : "Nouvelle machine"}
            </p>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              name="brand"
              required
              defaultValue={editingMachine?.brand}
              placeholder="Marque"
              className="admin-input"
            />
            <input
              name="model"
              required
              defaultValue={editingMachine?.model}
              placeholder="Modèle"
              className="admin-input"
            />
            <input
              name="reference"
              defaultValue={editingMachine?.reference ?? ""}
              placeholder="Référence constructeur (optionnel)"
              className="admin-input"
            />
            <input
              name="tonnage"
              type="number"
              required
              defaultValue={editingMachine?.tonnage}
              placeholder="Tonnage"
              className="admin-input"
            />
            <input
              name="year"
              type="number"
              required
              defaultValue={editingMachine?.year}
              placeholder="Année"
              className="admin-input"
            />
            <select name="drive" defaultValue={editingMachine?.drive ?? "hydraulique"} className="admin-input">
              {Object.entries(DRIVE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select name="condition" defaultValue={editingMachine?.condition ?? "occasion"} className="admin-input">
              {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={editingMachine?.status ?? "published"} className="admin-input">
              {(["published", "draft", "reserved", "sold"] as MachineStatus[]).map((v) => (
                <option key={v} value={v}>
                  {STATUS_LABELS[v]}
                </option>
              ))}
            </select>
            <input
              name="wilaya"
              defaultValue={editingMachine?.wilaya}
              placeholder="Wilaya"
              className="admin-input"
            />
            <input
              name="price"
              type="number"
              defaultValue={editingMachine?.price ?? ""}
              placeholder="Prix (DA)"
              className="admin-input"
            />
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                name="priceOnRequest"
                defaultChecked={editingMachine?.priceOnRequest}
              />{" "}
              Prix sur demande
            </label>
          </div>

          <textarea
            name="description"
            defaultValue={editingMachine?.description}
            placeholder="Description technique"
            rows={3}
            className="admin-input"
          />

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              Caractéristiques techniques (optionnel)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SPEC_FIELDS.map(({ key, label }) => (
                <input
                  key={key}
                  name={`spec_${key}`}
                  defaultValue={editingMachine?.specs?.[key] ?? ""}
                  placeholder={label}
                  className="admin-input"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
                Travaux effectués
              </p>
              <textarea
                name="worksPerformed"
                defaultValue={editingMachine?.worksPerformed?.join("\n")}
                placeholder={"Un élément par ligne"}
                rows={3}
                className="admin-input w-full"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
                Défauts connus
              </p>
              <textarea
                name="defects"
                defaultValue={editingMachine?.defects?.join("\n")}
                placeholder={"Un élément par ligne"}
                rows={3}
                className="admin-input w-full"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
                Accessoires inclus
              </p>
              <textarea
                name="accessories"
                defaultValue={editingMachine?.accessories?.join("\n")}
                placeholder={"Un élément par ligne"}
                rows={3}
                className="admin-input w-full"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              Photos (optionnel)
            </p>
            <PhotoUploader value={newPhotos} onChange={setNewPhotos} />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              Vidéo de la machine (optionnel)
            </p>
            <VideoUploader value={newVideo} onChange={setNewVideo} />
          </div>
          <input
            name="videoTitle"
            defaultValue={editingMachine?.videoTitle ?? ""}
            placeholder="Titre de la vidéo (optionnel)"
            className="admin-input"
          />

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b262f]"
          >
            {submitting
              ? "Enregistrement..."
              : editingMachine
                ? "Enregistrer les modifications"
                : "Ajouter la machine"}
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : marque, modèle, référence, wilaya..."
            className="admin-input w-full pl-8"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as MachineStatus | "all")}
          className="admin-input"
        >
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={filterDrive}
          onChange={(e) => setFilterDrive(e.target.value as MachineDrive | "all")}
          className="admin-input"
        >
          <option value="all">Tous les entraînements</option>
          {Object.entries(DRIVE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--color-text-muted)]">
          {filtered.length} / {machines.length}
        </span>
      </div>

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
            {filtered.map((m) => (
              <Fragment key={m.id}>
                <tr className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                    {m.brand} {m.model}
                    {m.reference && (
                      <p className="mt-0.5 text-xs font-normal text-[var(--color-text-muted)]">
                        Réf. {m.reference}
                      </p>
                    )}
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
                          onClick={() => startEdit(m)}
                          className="rounded-md p-1.5 text-[var(--color-accent)] hover:bg-blue-50"
                          aria-label="Modifier"
                          title="Modifier"
                        >
                          <Pencil size={15} />
                        </button>
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
                          aria-label="Modifier la vidéo"
                          title="Modifier la vidéo"
                        >
                          {editingVideoId === m.id ? <X size={15} /> : <Video size={15} />}
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Aucune machine ne correspond à la recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
