// Un lien blob: n'a de sens que dans l'onglet qui l'a créé — si on ouvre le
// PDF dans un nouvel onglet puis que l'utilisateur essaie de le partager
// (icône "Partager" du visualiseur PDF natif du téléphone) vers WhatsApp ou
// Messenger, l'app reçoit un lien blob: inutilisable en dehors du navigateur
// et le partage échoue silencieusement (ou envoie un lien mort).
//
// La seule façon fiable d'envoyer le PDF lui-même sur mobile est l'API Web
// Share avec un vrai fichier : ça ouvre la feuille de partage native du
// système avec le PDF en pièce jointe, prêt à envoyer. Sur desktop (où cette
// API n'est généralement pas supportée pour les fichiers), on garde
// l'ouverture classique dans un nouvel onglet, d'où l'utilisateur imprime
// directement via le visualiseur PDF du navigateur.
function canShareFile(file: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  );
}

/**
 * Vérification rapide et synchrone (pas besoin du PDF réel) — permet de
 * décider, dès le clic, s'il faut ouvrir un onglet vide à l'avance (pour
 * contourner les bloqueurs de popup côté desktop) ou non (le partage mobile
 * n'a pas besoin d'onglet).
 */
export function supportsPdfShare(): boolean {
  try {
    return canShareFile(new File([''], 'probe.pdf', { type: 'application/pdf' }));
  } catch {
    return false;
  }
}

/**
 * Récupère un PDF et l'ouvre (desktop) ou propose de le partager tel quel
 * (mobile). `win` est une fenêtre déjà ouverte de façon synchrone dans le
 * gestionnaire de clic (pour éviter les bloqueurs de popup) — à passer à
 * `null` quand `supportsPdfShare()` a répondu `true`, puisqu'elle ne sert
 * alors pas.
 */
export async function openOrSharePdf(fetchBlob: () => Promise<Blob>, filename: string, win: Window | null) {
  const blob = await fetchBlob();
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (canShareFile(file)) {
    win?.close();
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // annulé par l'utilisateur
      // le partage a échoué malgré la détection positive — on retombe sur l'ouverture classique
    }
  }

  const url = URL.createObjectURL(blob);
  if (win) {
    win.location.href = url;
  } else {
    window.open(url, '_blank');
  }
}
