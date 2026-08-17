export type VideoProvider = "youtube" | "vimeo" | "file";

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;

export function getVideoProvider(url: string): VideoProvider {
  if (YOUTUBE_RE.test(url)) return "youtube";
  if (VIMEO_RE.test(url)) return "vimeo";
  return "file";
}

/** Renvoie une URL d'intégration (iframe) pour YouTube/Vimeo, ou null si non applicable. */
export function getVideoEmbedUrl(url: string): string | null {
  const provider = getVideoProvider(url);
  if (provider === "youtube") {
    const match = url.match(YOUTUBE_RE);
    if (!match) return null;
    return `https://www.youtube-nocookie.com/embed/${match[1]}`;
  }
  if (provider === "vimeo") {
    const match = url.match(VIMEO_RE);
    if (!match) return null;
    return `https://player.vimeo.com/video/${match[1]}`;
  }
  return null;
}

/** Miniature automatique pour YouTube ; null pour Vimeo/fichier direct (fournir videoThumbnail dans ce cas). */
export function getAutoVideoThumbnail(url: string): string | null {
  if (getVideoProvider(url) !== "youtube") return null;
  const match = url.match(YOUTUBE_RE);
  if (!match) return null;
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
}
