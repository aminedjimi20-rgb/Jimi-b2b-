"use client";

import { useState, FormEvent } from "react";
import type { Testimonial, TestimonialStatus } from "@/lib/types";
import { Plus, Trash2, Lock, RefreshCw, Check, X, Star } from "lucide-react";

const STATUS_LABELS: Record<TestimonialStatus, string> = {
  pending: "En attente de validation",
  published: "Publié",
  rejected: "Rejeté",
};

const STATUS_TONE: Record<TestimonialStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

export function TestimonialsTab({ initialTestimonials }: { initialTestimonials: Testimonial[] }) {
  const [testimonials, setTestimonials] = useState(initialTestimonials);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/testimonials");
      const json = await res.json();
      setTestimonials(json.testimonials ?? []);
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
      const res = await fetch("/api/admin/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  async function setStatus(id: string, status: TestimonialStatus) {
    setTestimonials((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/api/admin/testimonials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement ce témoignage ?")) return;
    setTestimonials((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
  }

  const pendingCount = testimonials.filter((t) => t.status === "pending").length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Les témoignages soumis depuis <strong>/avis</strong> arrivent ici avec le statut{" "}
          <strong>En attente</strong> — approuvez-les pour les publier sur la page d&apos;accueil.
          Vous pouvez aussi ajouter directement un témoignage recueilli par téléphone/WhatsApp
          (publié immédiatement).
          {pendingCount > 0 && (
            <span className="ml-1 font-semibold text-amber-700">
              {pendingCount} en attente de validation.
            </span>
          )}
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
            <Plus size={14} /> Ajouter un témoignage
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5 sm:grid-cols-3"
        >
          <input name="name" required placeholder="Nom du client" className="admin-input" />
          <input name="company" placeholder="Entreprise (optionnel)" className="admin-input" />
          <select name="rating" defaultValue="5" className="admin-input">
            {[5, 4, 3, 2, 1].map((v) => (
              <option key={v} value={v}>
                {v} / 5
              </option>
            ))}
          </select>
          <textarea
            name="message"
            required
            placeholder="Témoignage"
            rows={3}
            className="admin-input sm:col-span-3"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b262f] sm:col-span-3"
          >
            {submitting ? "Ajout en cours..." : "Ajouter le témoignage (publié immédiatement)"}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {testimonials.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-text-muted)]">
            Aucun témoignage pour le moment.
          </p>
        ) : (
          testimonials.map((testimonial) => (
            <div key={testimonial.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[testimonial.status]}`}>
                    {STATUS_LABELS[testimonial.status]}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <Star
                        key={v}
                        size={13}
                        className={
                          v <= testimonial.rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300"
                        }
                      />
                    ))}
                  </span>
                  {testimonial.isDemo && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Lock size={11} /> Démo
                    </span>
                  )}
                </div>
                {!testimonial.isDemo && (
                  <div className="flex items-center gap-1">
                    {testimonial.status !== "published" && (
                      <button
                        onClick={() => setStatus(testimonial.id, "published")}
                        className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                        aria-label="Publier"
                        title="Publier"
                      >
                        <Check size={15} />
                      </button>
                    )}
                    {testimonial.status !== "rejected" && (
                      <button
                        onClick={() => setStatus(testimonial.id, "rejected")}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                        aria-label="Rejeter / masquer"
                        title="Rejeter / masquer"
                      >
                        <X size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => remove(testimonial.id)}
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm text-[var(--color-text)]">{testimonial.message}</p>
              <p className="mt-2 text-xs font-semibold text-[var(--color-ink)]">
                {testimonial.name}
                {testimonial.company && <span className="font-normal text-[var(--color-text-muted)]"> — {testimonial.company}</span>}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
