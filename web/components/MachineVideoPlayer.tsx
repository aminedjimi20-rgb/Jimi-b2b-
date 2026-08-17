import { getVideoProvider, getVideoEmbedUrl } from "@/lib/video";

export function MachineVideoPlayer({
  videoUrl,
  videoThumbnail,
  videoTitle,
}: {
  videoUrl: string;
  videoThumbnail?: string | null;
  videoTitle?: string | null;
}) {
  const provider = getVideoProvider(videoUrl);
  const title = videoTitle || "Vidéo de la machine";

  if (provider === "youtube" || provider === "vimeo") {
    const embedUrl = getVideoEmbedUrl(videoUrl);
    if (!embedUrl) return null;
    return (
      <div className="relative aspect-video w-full max-w-full overflow-hidden rounded-xl bg-[var(--color-ink)]">
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full max-w-full overflow-hidden rounded-xl bg-[var(--color-ink)]">
      <video
        controls
        playsInline
        preload="none"
        poster={videoThumbnail || undefined}
        className="absolute inset-0 h-full w-full"
      >
        <source src={videoUrl} type="video/mp4" />
      </video>
    </div>
  );
}
