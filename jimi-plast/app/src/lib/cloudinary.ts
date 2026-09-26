const CLOUD_NAME = 'igg1r7da';
const UPLOAD_PRESET = 'jimi_machines';

export class UploadError extends Error {}

/**
 * Upload direct navigateur → Cloudinary (preset "unsigned", aucune clé
 * secrète nécessaire côté client). Range les fichiers de jimi-plast sous
 * un dossier dédié pour rester séparés visuellement du reste du compte
 * Cloudinary (partagé avec jimi renovation).
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `jimi-plast/${folder}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new UploadError(body?.error?.message ?? "Échec de l'envoi de l'image");
  }

  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}
