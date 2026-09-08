"use client";

import { useState, FormEvent } from "react";
import type { ServiceVideoKey, ServiceVideos } from "@/lib/serviceVideos";
import { Video, Check } from "lucide-react";

const LABELS: Record<ServiceVideoKey, string> = {
  renovation: "Rénovation de machines d'injection",
  automation: "Automatisation industrielle",
  maintenance: "Maintenance & dépannage",
};

const KEYS: ServiceVideoKey[] = ["renovation", "automation", "maintenance"];

export function ServiceVideosSettings({ initialServiceVideos }: { initialServiceVideos: ServiceVideos }) {
  const [videos, setVideos] = useState(initialServiceVideos);
  const [savingKey, setSavingKey] = useState<ServiceVideoKey | null>(null);

  async function save(key: ServiceVideoKey, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingKey(key);
    const formData = new FormData(e.currentTarget);
    const videoUrl = String(formData.get("videoUrl") || "");
    const videoTitle = String(formData.get("videoTitle") || "");
    try {
      const res = await fetch("/api/admin/service-videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, videoUrl: videoUrl || null, videoTitle: videoTitle || null }),
      });
      if (res.ok) {
        setVideos((prev) => ({
          ...prev,
          [key]: videoUrl ? { videoUrl, videoTitle: videoTitle || null, videoThumbnail: null } : null,
        }));
      }
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Video size={18} className="text-[var(--color-accent)]" />
        <h2 className="text-base font-bold text-[var(--color-ink)]">Vidéos des pages Services</h2>
      </div>
      <p className="mb-5 text-sm text-[var(--color-text-muted)]">
        Une vidéo optionnelle (YouTube, Vimeo ou MP4) affichée en haut de chaque page de service
        pour expliquer la prestation. Laissez le lien vide puis enregistrez pour retirer une vidéo.
      </p>
      <div className="flex flex-col gap-5">
        {KEYS.map((key) => (
          <form
            key={key}
            onSubmit={(e) => save(key, e)}
            className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--color-border)] p-4 sm:grid-cols-3"
          >
            <p className="text-sm font-semibold text-[var(--color-ink)] sm:col-span-3">{LABELS[key]}</p>
            <input
              name="videoUrl"
              type="url"
              defaultValue={videos[key]?.videoUrl ?? ""}
              placeholder="Lien vidéo (MP4, YouTube ou Vimeo)"
              className="admin-input sm:col-span-2"
            />
            <input
              name="videoTitle"
              defaultValue={videos[key]?.videoTitle ?? ""}
              placeholder="Titre de la vidéo (optionnel)"
              className="admin-input"
            />
            <button
              type="submit"
              disabled={savingKey === key}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b58ad] sm:col-span-3"
            >
              <Check size={15} />
              {savingKey === key ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
