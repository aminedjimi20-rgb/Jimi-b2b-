"use client";

import { useState, FormEvent } from "react";
import { PhotoUploader } from "@/components/forms/MediaUploader";
import type { PartnerLogo } from "@/lib/partnerLogosStore";
import { Building2, Plus, Trash2 } from "lucide-react";

export function PartnerLogosSettings({ initialLogos }: { initialLogos: PartnerLogo[] }) {
  const [logos, setLogos] = useState(initialLogos);
  const [logoUrl, setLogoUrl] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const websiteUrl = String(form.get("websiteUrl") ?? "").trim();
    if (!name || logoUrl.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/partner-logos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logoUrl: logoUrl[0], websiteUrl }),
      });
      const json = await res.json();
      if (json.logo) {
        setLogos((prev) => [json.logo, ...prev]);
        setLogoUrl([]);
        e.currentTarget.reset();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Retirer ce logo du site ?")) return;
    setLogos((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/admin/partner-logos/${id}`, { method: "DELETE" });
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Building2 size={18} className="text-[var(--color-accent)]" />
        <h2 className="text-base font-bold text-[var(--color-ink)]">Entreprises partenaires</h2>
      </div>
      <p className="mb-5 text-sm text-[var(--color-text-muted)]">
        Logos des entreprises avec qui vous avez travaillé, affichés en bandeau dans le pied de page
        du site public. Laissez vide s&apos;il n&apos;y a rien à afficher — le bandeau n&apos;apparaît
        que si au moins un logo est ajouté.
      </p>

      <form onSubmit={onSubmit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg bg-[var(--color-surface-2)] p-4 sm:grid-cols-2">
        <input name="name" placeholder="Nom de l'entreprise" required className="admin-input" />
        <input name="websiteUrl" placeholder="Site web (optionnel)" className="admin-input" />
        <div className="sm:col-span-2">
          <PhotoUploader value={logoUrl} onChange={setLogoUrl} max={1} />
        </div>
        <button
          type="submit"
          disabled={saving || logoUrl.length === 0}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 sm:col-span-2"
        >
          <Plus size={14} /> {saving ? "Ajout..." : "Ajouter le logo"}
        </button>
      </form>

      {logos.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Aucun logo ajouté pour le moment.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {logos.map((logo) => (
            <div key={logo.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary domain unknown at build time */}
              <img src={logo.logoUrl} alt={logo.name} className="h-8 w-auto object-contain" />
              <span className="text-xs font-medium text-[var(--color-text)]">{logo.name}</span>
              <button onClick={() => remove(logo.id)} className="rounded-md p-1 text-red-500 hover:bg-red-50" aria-label="Retirer">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
