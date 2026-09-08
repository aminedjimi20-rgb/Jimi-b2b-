"use client";

import { useState, FormEvent } from "react";
import type { ServiceVideoKey, ServiceVideos } from "@/lib/serviceVideos";
import { VideoUploader } from "@/components/forms/MediaUploader";
import { Video, Check } from "lucide-react";

const LABELS: Record<ServiceVideoKey, string> = {
  renovation: "Rénovation de machines d'injection",
  automation: "Automatisation industrielle",
  maintenance: "Maintenance & dépannage",
};

const KEYS: ServiceVideoKey[] = ["renovation", "automation", "maintenance"];

export function ServiceVideosSettings({ initialServiceVideos }: { initialServiceVideos: ServiceVideos }) {
  const [videos, setVideos] = useState(initialServiceVideos);
  const [videoUrls, setVideoUrls] = useState<Record<ServiceVideoKey, string | null>>({
    renovation: initialServiceVideos.renovation?.videoUrl ?? null,
    automation: initialServiceVideos.automation?.videoUrl ?? null,
    maintenance: initialServiceVideos.maintenance?.videoUrl ?? null,
  });
  const [savingKey, setSavingKey] = useState<ServiceVideoKey | null>(null);

  async function save(key: ServiceVideoKey, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingKey(key);
    const formData = new FormData(e.currentTarget);
    const videoUrl = videoUrls[key];
    const videoTitle = String(formData.get("videoTitle") || "");
    try {
      const res = await fetch("/api/admin/service-videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, videoUrl, videoTitle: videoTitle || null }),
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
        Une vidéo optionnelle envoyée directement depuis la galerie de votre téléphone, affichée en
        haut de chaque page de service pour expliquer la prestation. Supprimez la vidéo puis
        enregistrez pour la retirer.
      </p>
      <div className="flex flex-col gap-5">
        {KEYS.map((key) => (
          <form
            key={key}
            onSubmit={(e) => save(key, e)}
            className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-4"
          >
            <p className="text-sm font-semibold text-[var(--color-ink)]">{LABELS[key]}</p>
            <VideoUploader
              value={videoUrls[key]}
              onChange={(url) => setVideoUrls((prev) => ({ ...prev, [key]: url }))}
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
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b58ad]"
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
