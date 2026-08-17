"use client";

import { useState, FormEvent } from "react";
import type { Machine, MachineDrive } from "@/lib/types";
import type { SellerProfile } from "@/lib/sellers";
import { PhotoUploader } from "@/components/forms/MediaUploader";
import {
  RefreshCw,
  Check,
  X,
  Pencil,
  MessageCircle,
  Phone,
  Mail,
  Image as ImageIcon,
  Video,
  Clock,
} from "lucide-react";

const DRIVE_LABELS: Record<MachineDrive, string> = {
  hydraulique: "Hydraulique",
  servo: "Servo",
  hybride: "Hybride",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  draft: "Modifications demandées",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  draft: "bg-orange-50 text-orange-700",
};

export function PendingListingsTab({
  initialMachines,
  sellers,
}: {
  initialMachines: Machine[];
  sellers: SellerProfile[];
}) {
  const [machines, setMachines] = useState(initialMachines);
  const sellerById = new Map(sellers.map((s) => [s.id, s]));
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  function startEdit(m: Machine) {
    if (editingId === m.id) {
      setEditingId(null);
      return;
    }
    setEditingId(m.id);
    setEditPhotos(m.photos ?? []);
  }

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/machines");
      const json = await res.json();
      const all = (json.machines ?? []) as Machine[];
      setMachines(all.filter((m) => m.status === "pending" || m.status === "draft"));
    } finally {
      setLoading(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/machines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        const updated = json.machine as Machine;
        if (updated.status === "pending" || updated.status === "draft") {
          setMachines((prev) => prev.map((m) => (m.id === id ? updated : m)));
        } else {
          setMachines((prev) => prev.filter((m) => m.id !== id));
        }
        setEditingId(null);
      }
    } finally {
      setBusyId(null);
    }
  }

  function approve(id: string) {
    patch(id, { status: "published" });
  }

  function reject(id: string) {
    const reason = window.prompt("Motif du rejet (optionnel, usage interne uniquement) :");
    if (reason === null) return;
    patch(id, { status: "rejected", adminNote: reason || null });
  }

  function requestChanges(id: string) {
    const note = window.prompt("Quelles modifications ou informations demander au vendeur ?");
    if (!note) return;
    patch(id, { status: "draft", adminNote: note });
  }

  async function saveEdit(id: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await patch(id, {
      brand: String(formData.get("brand") || ""),
      model: String(formData.get("model") || ""),
      tonnage: Number(formData.get("tonnage")),
      year: Number(formData.get("year")),
      drive: String(formData.get("drive") || "hydraulique"),
      wilaya: String(formData.get("wilaya") || ""),
      price: formData.get("price") ? Number(formData.get("price")) : null,
      priceOnRequest: formData.get("priceOnRequest") === "on",
      description: String(formData.get("description") || ""),
      videoUrl: String(formData.get("videoUrl") || "") || null,
      photos: editPhotos,
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Ces annonces envoyées par des vendeurs <strong>n&apos;apparaissent pas</strong> sur le site
          public tant qu&apos;elles ne sont pas approuvées.
        </p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      {machines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-text-muted)]">
          Aucune annonce à valider pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {machines.map((m) => (
            <div key={m.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[m.status]}`}>
                    {STATUS_LABELS[m.status]}
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-ink)]">
                    {m.brand} {m.model}
                  </span>
                  {m.submittedAt && (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Clock size={12} /> {new Date(m.submittedAt).toLocaleString("fr-FR")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => startEdit(m)}
                    className="rounded-md p-1.5 text-[var(--color-accent)] hover:bg-blue-50"
                    aria-label="Modifier"
                  >
                    {editingId === m.id ? <X size={15} /> : <Pencil size={15} />}
                  </button>
                  <button
                    disabled={busyId === m.id}
                    onClick={() => requestChanges(m.id)}
                    className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    Demander des modifs
                  </button>
                  <button
                    disabled={busyId === m.id}
                    onClick={() => reject(m.id)}
                    className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Rejeter
                  </button>
                  <button
                    disabled={busyId === m.id}
                    onClick={() => approve(m.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check size={13} /> Approuver &amp; publier
                  </button>
                </div>
              </div>

              {m.adminNote && m.status === "draft" && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <strong>Modifications demandées :</strong> {m.adminNote}
                </p>
              )}

              {editingId === m.id ? (
                <form
                  onSubmit={(e) => saveEdit(m.id, e)}
                  className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-[var(--color-surface-2)] p-4 sm:grid-cols-3"
                >
                  <input name="brand" defaultValue={m.brand} placeholder="Marque" className="admin-input" required />
                  <input name="model" defaultValue={m.model} placeholder="Modèle" className="admin-input" required />
                  <input
                    name="tonnage"
                    type="number"
                    defaultValue={m.tonnage}
                    placeholder="Tonnage"
                    className="admin-input"
                    required
                  />
                  <input name="year" type="number" defaultValue={m.year} placeholder="Année" className="admin-input" />
                  <select name="drive" defaultValue={m.drive} className="admin-input">
                    {Object.entries(DRIVE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input name="wilaya" defaultValue={m.wilaya} placeholder="Wilaya" className="admin-input" />
                  <input
                    name="price"
                    type="number"
                    defaultValue={m.price ?? ""}
                    placeholder="Prix (DA)"
                    className="admin-input"
                  />
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                    <input type="checkbox" name="priceOnRequest" defaultChecked={m.priceOnRequest} /> Prix sur demande
                  </label>
                  <input
                    name="videoUrl"
                    type="url"
                    defaultValue={m.videoUrl ?? ""}
                    placeholder="Lien vidéo"
                    className="admin-input sm:col-span-2"
                  />
                  <div className="sm:col-span-3">
                    <PhotoUploader value={editPhotos} onChange={setEditPhotos} />
                  </div>
                  <textarea
                    name="description"
                    defaultValue={m.description}
                    rows={3}
                    placeholder="Description"
                    className="admin-input sm:col-span-3"
                  />
                  <button
                    type="submit"
                    disabled={busyId === m.id}
                    className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b262f] sm:col-span-3"
                  >
                    Enregistrer les modifications
                  </button>
                </form>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    <div>
                      <span className="font-medium text-[var(--color-text-muted)]">Tonnage :</span> {m.tonnage} T
                    </div>
                    <div>
                      <span className="font-medium text-[var(--color-text-muted)]">Année :</span> {m.year}
                    </div>
                    <div>
                      <span className="font-medium text-[var(--color-text-muted)]">Type :</span>{" "}
                      {DRIVE_LABELS[m.drive]}
                    </div>
                    <div>
                      <span className="font-medium text-[var(--color-text-muted)]">Wilaya :</span> {m.wilaya || "—"}
                    </div>
                    <div>
                      <span className="font-medium text-[var(--color-text-muted)]">Prix demandé :</span>{" "}
                      {m.priceOnRequest || !m.price ? "Sur demande" : `${m.price.toLocaleString("fr-FR")} DA`}
                    </div>
                  </div>
                  {m.description && (
                    <p className="mt-3 whitespace-pre-line text-sm text-[var(--color-text)]">{m.description}</p>
                  )}
                  {(m.videoUrl || (m.photos && m.photos.length > 0)) && (
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      {m.videoUrl && (
                        <a
                          href={m.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                        >
                          <Video size={13} /> Vidéo
                        </a>
                      )}
                      {m.photos?.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                        >
                          <ImageIcon size={13} /> Photo {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}

              {m.sellerId &&
                (() => {
                  const seller = sellerById.get(m.sellerId!);
                  if (!seller) return null;
                  return (
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] pt-3 text-xs">
                      <span className="font-semibold text-[var(--color-ink)]">
                        {seller.name}
                        {seller.company ? ` — ${seller.company}` : ""}
                      </span>
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
                  );
                })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
