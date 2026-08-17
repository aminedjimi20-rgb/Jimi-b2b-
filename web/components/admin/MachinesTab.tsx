"use client";

import { useState, FormEvent } from "react";
import type { Machine, MachineDrive, MachineStatus } from "@/lib/types";
import { Plus, Trash2, Lock, RefreshCw } from "lucide-react";

const STATUS_LABELS: Record<MachineStatus, string> = {
  disponible: "Disponible",
  vendue: "Vendue",
  reservee: "Réservée",
  nouveau: "Nouveau",
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
        }),
      });
      if (res.ok) {
        e.currentTarget.reset();
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

  async function remove(id: string) {
    if (!confirm("Supprimer cette machine ?")) return;
    setMachines((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/admin/machines/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Les machines <strong>« Démo »</strong> proviennent des données d&apos;exemple du site
          (non modifiables ici). Les machines que vous ajoutez ci-dessous apparaissent
          immédiatement sur le site public.
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
          <select name="status" defaultValue="disponible" className="admin-input">
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
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
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-start text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-4 py-3 text-start">Machine</th>
              <th className="px-4 py-3 text-start">Tonnage</th>
              <th className="px-4 py-3 text-start">Wilaya</th>
              <th className="px-4 py-3 text-start">Statut</th>
              <th className="px-4 py-3 text-start">Source</th>
              <th className="px-4 py-3 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                  {m.brand} {m.model}
                </td>
                <td className="px-4 py-3">{m.tonnage} T</td>
                <td className="px-4 py-3">{m.wilaya}</td>
                <td className="px-4 py-3">
                  {m.isDemo ? (
                    STATUS_LABELS[m.status]
                  ) : (
                    <select
                      value={m.status}
                      onChange={(e) => setStatus(m.id, e.target.value as MachineStatus)}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
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
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Lock size={11} /> Démo
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-600">Réelle</span>
                  )}
                </td>
                <td className="px-4 py-3 text-end">
                  {!m.isDemo && (
                    <button
                      onClick={() => remove(m.id)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
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
