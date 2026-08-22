"use client";

import { useRef, useState } from "react";
import { ImagePlus, VideoIcon, X, Star, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from "lucide-react";

const PHOTO_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";
const VIDEO_ACCEPT = "video/mp4,video/webm";

interface UploaderLabels {
  addPhotos: string;
  addVideo: string;
  uploading: string;
  mainPhotoBadge: string;
  setAsMain: string;
  remove: string;
  replace: string;
  maxReached: string;
  notConfigured: string;
}

const DEFAULT_LABELS: UploaderLabels = {
  addPhotos: "Ajouter des photos",
  addVideo: "Ajouter une vidéo",
  uploading: "Envoi en cours…",
  mainPhotoBadge: "Principale",
  setAsMain: "Définir comme principale",
  remove: "Supprimer",
  replace: "Remplacer",
  maxReached: "Nombre maximum de photos atteint",
  notConfigured: "Le stockage des fichiers n'est pas encore configuré.",
};

// Uploads straight from the browser to Cloudinary (unsigned upload preset) —
// no server round-trip, no signed URL, no billing account required. Cloud
// name and preset are public by design (the preset itself, configured in the
// Cloudinary dashboard, is what restricts folder/size/format — see
// cloudinary/README.md).
function uploadOne(
  file: File,
  kind: "photo" | "video",
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) {
      reject(new Error("Configuration de stockage manquante."));
      return;
    }

    const resourceType = kind === "photo" ? "image" : "video";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", preset);
    formData.append("folder", `machines/${kind}s`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url as string);
        } catch {
          reject(new Error("Réponse invalide du stockage."));
        }
      } else {
        reject(new Error("Échec de l'envoi du fichier."));
      }
    };
    xhr.onerror = () => reject(new Error("Échec de l'envoi du fichier (réseau)."));
    xhr.send(formData);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

type UploadItem = { id: string; name: string; status: "uploading" | "error"; progress: number; error?: string };

export function PhotoUploader({
  value,
  onChange,
  max = 6,
  labels = DEFAULT_LABELS,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  labels?: UploaderLabels;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const room = Math.max(0, max - value.length);
    const files = Array.from(fileList).slice(0, room);
    let current = value;
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setItems((prev) => [...prev, { id, name: file.name, status: "uploading", progress: 0 }]);
      try {
        const url = await uploadOne(file, "photo", (progress) =>
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, progress } : it)))
        );
        current = [...current, url];
        onChange(current);
        setItems((prev) => prev.filter((it) => it.id !== id));
      } catch (e) {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: "error", error: (e as Error).message } : it))
        );
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function setMain(url: string) {
    onChange([url, ...value.filter((u) => u !== url)]);
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function dismiss(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--color-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage URL */}
              <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                  {labels.mainPhotoBadge}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-30"
                    aria-label="Déplacer à gauche"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === value.length - 1}
                    className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-30"
                    aria-label="Déplacer à droite"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="flex gap-0.5">
                  {i !== 0 && (
                    <button
                      type="button"
                      onClick={() => setMain(url)}
                      className="rounded p-1 text-white hover:bg-white/20"
                      aria-label={labels.setAsMain}
                      title={labels.setAsMain}
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(url)}
                    className="rounded p-1 text-white hover:bg-red-500/80"
                    aria-label={labels.remove}
                    title={labels.remove}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {items.map((it) => (
            <div
              key={it.id}
              className={`overflow-hidden rounded-lg border text-xs ${
                it.status === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                {it.status === "uploading" ? (
                  <Loader2 size={14} className="shrink-0 animate-spin" />
                ) : (
                  <AlertCircle size={14} className="shrink-0" />
                )}
                <span className="flex-1 truncate">
                  {it.status === "uploading" ? `${labels.uploading} ${it.name} (${it.progress}%)` : it.error}
                </span>
                {it.status === "error" && (
                  <button type="button" onClick={() => dismiss(it.id)} className="shrink-0 font-semibold hover:underline">
                    OK
                  </button>
                )}
              </div>
              {it.status === "uploading" && (
                <div className="h-1 w-full bg-[var(--color-border)]">
                  <div
                    className="h-1 bg-[var(--color-accent)] transition-all"
                    style={{ width: `${it.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {value.length < max ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          <ImagePlus size={16} /> {labels.addPhotos}
        </button>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">{labels.maxReached}</p>
      )}
    </div>
  );
}

export function VideoUploader({
  value,
  onChange,
  labels = DEFAULT_LABELS,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  labels?: UploaderLabels;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setFileSize(file.size);
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadOne(file, "video", setProgress);
      onChange(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove() {
    onChange(null);
    setFileSize(null);
    setDuration(null);
  }

  return (
    <div>
      {value && (
        <div className="mb-3 overflow-hidden rounded-lg border border-[var(--color-border)]">
          <video
            src={value}
            controls
            className="max-h-64 w-full bg-black"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          />
          <div className="flex items-center justify-between gap-2 bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            <span>
              {duration ? `${Math.round(duration)}s` : ""}
              {duration && fileSize ? " · " : ""}
              {fileSize ? formatSize(fileSize) : ""}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
              >
                <RefreshCw size={12} /> {labels.replace}
              </button>
              <button type="button" onClick={remove} className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline">
                <X size={12} /> {labels.remove}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {uploading && (
        <div className="mb-3 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-muted)]">
            <Loader2 size={14} className="shrink-0 animate-spin" /> {labels.uploading} ({progress}%)
          </div>
          <div className="h-1 w-full bg-[var(--color-border)]">
            <div className="h-1 bg-[var(--color-accent)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {!value && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          <VideoIcon size={16} /> {labels.addVideo}
        </button>
      )}
    </div>
  );
}
