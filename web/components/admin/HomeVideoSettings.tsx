"use client";

import { useState, FormEvent } from "react";
import type { HomeVideo } from "@/lib/homeVideoStore";
import { VideoUploader } from "@/components/forms/MediaUploader";
import { Video, Check } from "lucide-react";

export function HomeVideoSettings({ initialHomeVideo }: { initialHomeVideo: HomeVideo }) {
  const [videoUrl, setVideoUrl] = useState(initialHomeVideo.videoUrl);
  const [saving, setSaving] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const videoTitle = String(formData.get("videoTitle") || "");
    try {
      await fetch("/api/admin/home-video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, videoTitle: videoTitle || null }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Video size={18} className="text-[var(--color-accent)]" />
        <h2 className="text-base font-bold text-[var(--color-ink)]">Vidéo de présentation (accueil)</h2>
      </div>
      <p className="mb-5 text-sm text-[var(--color-text-muted)]">
        Une vidéo optionnelle, envoyée directement depuis la galerie de votre téléphone, affichée sur
        la page d&apos;accueil juste après les 3 cartes &laquo; Que souhaitez-vous faire ? &raquo; pour
        expliquer aux visiteurs comment fonctionne le site. Supprimez le fichier puis enregistrez pour
        la retirer.
      </p>
      <form onSubmit={save} className="flex flex-col gap-3">
        <VideoUploader value={videoUrl} onChange={setVideoUrl} />
        <input
          name="videoTitle"
          defaultValue={initialHomeVideo.videoTitle ?? ""}
          placeholder="Titre de la vidéo (optionnel)"
          className="admin-input"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b58ad] disabled:opacity-50"
        >
          <Check size={15} />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
