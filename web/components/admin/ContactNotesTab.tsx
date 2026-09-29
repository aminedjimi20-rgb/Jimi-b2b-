"use client";

import { useMemo, useState, FormEvent } from "react";
import type { ContactNote, ContactNoteType } from "@/lib/contactNotesStore";
import { wilayas } from "@/lib/wilayas";
import { Plus, Trash2, Pencil, X, Search, User } from "lucide-react";

const TYPE_LABELS: Record<ContactNoteType, string> = {
  client: "Client",
  prospect: "Prospect",
  autre: "Autre",
};

const TYPE_TONE: Record<ContactNoteType, string> = {
  client: "bg-emerald-50 text-emerald-700",
  prospect: "bg-blue-50 text-blue-700",
  autre: "bg-slate-100 text-slate-700",
};

export function ContactNotesTab({ initialNotes }: { initialNotes: ContactNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ContactNoteType | "all">("all");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const editingNote = notes.find((n) => n.id === editingId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (filterType !== "all" && n.type !== filterType) return false;
      if (!q) return true;
      return (
        n.name.toLowerCase().includes(q) ||
        (n.phone ?? "").toLowerCase().includes(q) ||
        (n.wilaya ?? "").toLowerCase().includes(q) ||
        n.notes.toLowerCase().includes(q)
      );
    });
  }, [notes, search, filterType]);

  function startAdd() {
    setEditingId("new");
  }
  function startEdit(note: ContactNote) {
    setEditingId(note.id);
  }
  function cancelForm() {
    setEditingId(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      type: String(form.get("type") ?? "prospect") as ContactNoteType,
      wilaya: String(form.get("wilaya") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };

    if (editingId && editingId !== "new") {
      const res = await fetch(`/api/admin/contact-notes/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.note) {
        setNotes((prev) => prev.map((n) => (n.id === editingId ? json.note : n)));
      }
    } else {
      const res = await fetch("/api/admin/contact-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.note) {
        setNotes((prev) => [json.note, ...prev]);
      }
    }
    setEditingId(null);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cette fiche ?")) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/admin/contact-notes/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        Carnet d&apos;adresses privé — visible uniquement par toi dans l&apos;admin. Sert à garder les
        coordonnées et le contexte de clients ou prospects rencontrés (WhatsApp, téléphone, en personne...)
        pour les recontacter plus tard.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : nom, téléphone, wilaya, note..."
            className="admin-input ps-9"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ContactNoteType | "all")}
          className="admin-input w-auto"
        >
          <option value="all">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          onClick={startAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          <Plus size={14} /> Ajouter un contact
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
              {editingId === "new" ? "Nouveau contact" : "Modifier le contact"}
            </p>
            <button type="button" onClick={cancelForm} className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input name="name" defaultValue={editingNote?.name} placeholder="Nom" required className="admin-input" />
            <input name="phone" defaultValue={editingNote?.phone} placeholder="Téléphone" className="admin-input" />
            <select name="type" defaultValue={editingNote?.type ?? "prospect"} className="admin-input">
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select name="wilaya" defaultValue={editingNote?.wilaya ?? ""} className="admin-input">
              <option value="">Wilaya —</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.fr}>
                  {w.fr}
                </option>
              ))}
            </select>
            <textarea
              name="notes"
              defaultValue={editingNote?.notes}
              placeholder="Notes libres : ce qu'il cherche, contexte, dernier échange..."
              rows={4}
              className="admin-input sm:col-span-2"
            />
          </div>
          <button
            type="submit"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            {editingId === "new" ? "Ajouter" : "Enregistrer"}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-text-muted)]">
          Aucun contact ne correspond à la recherche.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((note) => (
            <div key={note.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                    <User size={15} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-ink)]">{note.name}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      {note.phone && <span>{note.phone}</span>}
                      {note.wilaya && <span>· {note.wilaya}</span>}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_TONE[note.type]}`}>
                    {TYPE_LABELS[note.type]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => startEdit(note)} className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]" aria-label="Modifier">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(note.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50" aria-label="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {note.notes && (
                <p className="mt-3 whitespace-pre-wrap border-t border-[var(--color-border)] pt-3 text-sm text-[var(--color-text)]">
                  {note.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
