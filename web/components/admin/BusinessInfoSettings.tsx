"use client";

import { useState, FormEvent } from "react";
import type { BusinessInfo, FaqEntry } from "@/lib/businessInfoStore";
import { BookOpen, Check, Plus, Trash2 } from "lucide-react";

function toLines(value: string[]): string {
  return value.join("\n");
}

function fromLines(value: string): string[] {
  return value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Édition de la base de connaissances utilisée par l'assistant IA (marques,
 *  services, zones d'intervention, conditions, FAQ) — sans toucher au code.
 *  L'IA n'utilise QUE ces informations (+ le catalogue machines/pièces) pour
 *  répondre : c'est la garantie qu'elle n'invente rien. */
export function BusinessInfoSettings({ initialBusinessInfo }: { initialBusinessInfo: BusinessInfo }) {
  const [brands, setBrands] = useState(initialBusinessInfo.brands.join(", "));
  const [services, setServices] = useState(toLines(initialBusinessInfo.services));
  const [zones, setZones] = useState(initialBusinessInfo.interventionZones.join(", "));
  const [conditions, setConditions] = useState(initialBusinessInfo.conditions);
  const [notes, setNotes] = useState(initialBusinessInfo.notes);
  const [faq, setFaq] = useState<FaqEntry[]>(initialBusinessInfo.faq);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateFaq(index: number, patch: Partial<FaqEntry>) {
    setFaq((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addFaq() {
    setFaq((prev) => [...prev, { question: "", answer: "" }]);
  }

  function removeFaq(index: number) {
    setFaq((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brands: brands.split(",").map((v) => v.trim()).filter(Boolean),
          services: fromLines(services),
          interventionZones: zones.split(",").map((v) => v.trim()).filter(Boolean),
          conditions,
          notes,
          faq: faq.filter((f) => f.question.trim() && f.answer.trim()),
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-[var(--color-border)] bg-white p-6">
      <div className="mb-2 flex items-center gap-2">
        <BookOpen size={18} className="text-[var(--color-accent)]" />
        <h2 className="text-base font-bold text-[var(--color-ink)]">Base de connaissances de l&apos;IA</h2>
      </div>
      <p className="mb-5 text-sm text-[var(--color-text-muted)]">
        L&apos;assistant IA (WhatsApp + testeur) utilise uniquement ces informations, plus le
        catalogue machines/pièces publié, pour répondre — il ne doit jamais inventer un prix, un
        délai ou une caractéristique qui n&apos;est pas ici.
      </p>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
            Marques travaillées (séparées par des virgules)
          </span>
          <input
            value={brands}
            onChange={(e) => setBrands(e.target.value)}
            placeholder="Haitian, Engel, Arburg, Krauss Maffei..."
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
            Services proposés (un par ligne)
          </span>
          <textarea
            value={services}
            onChange={(e) => setServices(e.target.value)}
            rows={4}
            placeholder={"Rénovation de presses à injection\nAutomatisation industrielle (PLC/HMI)\nMaintenance et dépannage"}
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
            Zones d&apos;intervention (séparées par des virgules)
          </span>
          <input
            value={zones}
            onChange={(e) => setZones(e.target.value)}
            placeholder="Alger, Blida, Tipaza, toute l'Algérie sur demande..."
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
            Conditions commerciales
          </span>
          <textarea
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            rows={3}
            placeholder="Délai de réponse, garantie, modalités de paiement..."
            className="admin-input"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
            Notes internes pour l&apos;IA (non visibles par les clients)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Contexte utile, éléments à mettre en avant..."
            className="admin-input"
          />
        </label>

        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
            Questions fréquentes
          </span>
          <div className="flex flex-col gap-3">
            {faq.map((entry, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3">
                <div className="flex items-start gap-2">
                  <input
                    value={entry.question}
                    onChange={(e) => updateFaq(i, { question: e.target.value })}
                    placeholder="Question"
                    className="admin-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeFaq(i)}
                    className="mt-1 shrink-0 rounded-md p-1.5 text-red-500 hover:bg-red-50"
                    aria-label="Supprimer cette question"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <textarea
                  value={entry.answer}
                  onChange={(e) => updateFaq(i, { answer: e.target.value })}
                  placeholder="Réponse"
                  rows={2}
                  className="admin-input"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addFaq}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
          >
            <Plus size={13} /> Ajouter une question
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b58ad] disabled:opacity-50"
        >
          <Check size={15} />
          {saving ? "Enregistrement..." : saved ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
