"use client";

import { useMemo, useState, FormEvent } from "react";
import type { WantedListing, WantedCategory, WantedStatus } from "@/lib/wantedListingsStore";
import { wilayas } from "@/lib/wilayas";
import { Plus, Trash2, Pencil, X, Search, Eye, EyeOff } from "lucide-react";

const CATEGORY_LABELS: Record<WantedCategory, string> = {
  machine: "Machine",
  piece: "Pièce",
  moule: "Moule",
  autre: "Autre",
};

const STATUS_LABELS: Record<WantedStatus, string> = {
  draft: "Brouillon (masquée)",
  published: "Publiée",
};

export function WantedListingsTab({ initialListings }: { initialListings: WantedListing[] }) {
  const [listings, setListings] = useState(initialListings);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<WantedStatus | "all">("all");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const editingListing = listings.find((l) => l.id === editingId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (!q) return true;
      return l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q);
    });
  }, [listings, search, filterStatus]);

  function startAdd() {
    setEditingId("new");
  }
  function startEdit(listing: WantedListing) {
    setEditingId(listing.id);
  }
  function cancelForm() {
    setEditingId(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      title: String(form.get("title") ?? ""),
      category: String(form.get("category") ?? "autre") as WantedCategory,
      description: String(form.get("description") ?? ""),
      wilaya: String(form.get("wilaya") ?? ""),
      status: String(form.get("status") ?? "draft") as WantedStatus,
    };

    if (editingId && editingId !== "new") {
      const res = await fetch(`/api/admin/wanted-listings/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.listing) {
        setListings((prev) => prev.map((l) => (l.id === editingId ? json.listing : l)));
      }
    } else {
      const res = await fetch("/api/admin/wanted-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.listing) {
        setListings((prev) => [json.listing, ...prev]);
      }
    }
    setEditingId(null);
  }

  async function toggleStatus(listing: WantedListing) {
    const status: WantedStatus = listing.status === "published" ? "draft" : "published";
    setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, status } : l)));
    await fetch(`/api/admin/wanted-listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cette annonce ?")) return;
    setListings((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/admin/wanted-listings/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        Annonces publiques &quot;Recherché&quot; affichées sur <strong>/recherches</strong> — utile quand
        un client cherche une machine/pièce/moule précise que vous n&apos;avez pas en catalogue. Les
        visiteurs qui ont l&apos;équipement peuvent cliquer &quot;J&apos;ai ça&quot; pour laisser leurs
        coordonnées, sans jamais voir celles du demandeur.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : titre, description..."
            className="admin-input ps-9"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as WantedStatus | "all")} className="admin-input w-auto">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          onClick={startAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          <Plus size={14} /> Publier une recherche
        </button>
      </div>

      {editingId && (
        <form
          key={editingId}
          onSubmit={onSubmit}
          className="mb-5 rounded-xl border border-[var(--color-border)] bg-white p-4 md:p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              {editingId === "new" ? "Nouvelle recherche" : "Modifier la recherche"}
            </p>
            <button type="button" onClick={cancelForm} className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="title"
              defaultValue={editingListing?.title}
              placeholder="Ex: Broyeur plastique 200-300 kg/h"
              required
              className="admin-input sm:col-span-2"
            />
            <select name="category" defaultValue={editingListing?.category ?? "autre"} className="admin-input">
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select name="wilaya" defaultValue={editingListing?.wilaya ?? ""} className="admin-input">
              <option value="">Wilaya —</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.fr}>
                  {w.fr}
                </option>
              ))}
            </select>
            <textarea
              name="description"
              defaultValue={editingListing?.description}
              placeholder="Spécifications recherchées, contexte..."
              rows={3}
              className="admin-input sm:col-span-2"
            />
            <select name="status" defaultValue={editingListing?.status ?? "draft"} className="admin-input">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            {editingId === "new" ? "Publier" : "Enregistrer"}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-text-muted)]">
          Aucune recherche ne correspond.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((listing) => (
            <div key={listing.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {CATEGORY_LABELS[listing.category]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        listing.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {STATUS_LABELS[listing.status]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-[var(--color-ink)]">{listing.title}</p>
                  {listing.wilaya && <p className="text-xs text-[var(--color-text-muted)]">{listing.wilaya}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleStatus(listing)}
                    className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
                    aria-label={listing.status === "published" ? "Dépublier" : "Publier"}
                  >
                    {listing.status === "published" ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button onClick={() => startEdit(listing)} className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]" aria-label="Modifier">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(listing.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50" aria-label="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {listing.description && (
                <p className="mt-3 whitespace-pre-wrap border-t border-[var(--color-border)] pt-3 text-sm text-[var(--color-text)]">
                  {listing.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
