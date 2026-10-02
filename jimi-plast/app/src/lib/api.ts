const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const TOKEN_KEY = 'jimiplast_access_token';
export const REFRESH_KEY = 'jimiplast_refresh_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type TokensUpdatedHandler = (accessToken: string | null) => void;
let onTokensUpdated: TokensUpdatedHandler | null = null;

export function setTokensUpdatedHandler(handler: TokensUpdatedHandler | null) {
  onTokensUpdated = handler;
}

let refreshPromise: Promise<string | null> | null = null;

const WAKE_UP_RETRY_DELAYS_MS = [4000, 8000, 15000];
// Le réveil de Render peut prendre jusqu'à ~50s (voir plus bas) — perdre la
// session entière coûte bien plus cher qu'un appel de données qui échoue une
// fois, donc le rafraîchissement du token se donne une marge plus large que
// WAKE_UP_RETRY_DELAYS_MS (27s au total, déjà insuffisant pour le pire cas
// documenté) avant de conclure à un vrai rejet.
const REFRESH_WAKE_UP_RETRY_DELAYS_MS = [3000, 5000, 8000, 12000, 15000, 20000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Un vrai rejet : le serveur a bien répondu et a explicitement invalidé ce
 * refresh token (401/403 avec un corps JSON lisible) — pas une panne
 * réseau, pas la page de réveil HTML de Render pendant que l'instance
 * gratuite redémarre après ~15 min d'inactivité.
 */
async function attemptRefresh(refreshToken: string): Promise<{ kind: 'ok'; accessToken: string; refreshToken: string } | { kind: 'rejected' } | { kind: 'transient' }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return { kind: 'transient' };
  }

  if (res.status >= 500 || res.status === 0) return { kind: 'transient' };

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // 200 mais pas du JSON : page d'attente HTML de Render, pas un vrai rejet.
    return { kind: 'transient' };
  }

  if (!res.ok) return { kind: 'rejected' };
  const data = body as { accessToken: string; refreshToken: string };
  return { kind: 'ok', accessToken: data.accessToken, refreshToken: data.refreshToken };
}

/**
 * L'access token expire au bout de 15 min (voir ACCESS_TOKEN_TTL côté API).
 * Sans ce rafraîchissement silencieux, toute session ouverte plus de 15 min
 * perd l'authentification au prochain appel — d'où les "erreurs réseau" et
 * déconnexions signalées après une pause.
 *
 * Cas particulier : une session laissée ouverte toute une nuit tombe sur
 * l'instance Render gratuite endormie (15 min d'inactivité) juste au moment
 * où elle a besoin de rafraîchir son token. Une simple panne réseau ou la
 * page HTML de réveil de Render ne doivent jamais être interprétées comme
 * "refresh token invalide" — on réessaie plusieurs fois pendant le réveil
 * (~30-50s) avant d'abandonner, exactement comme request() le fait déjà
 * pour les appels normaux.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      for (let attempt = 0; ; attempt++) {
        const result = await attemptRefresh(refreshToken);

        if (result.kind === 'ok') {
          localStorage.setItem(TOKEN_KEY, result.accessToken);
          localStorage.setItem(REFRESH_KEY, result.refreshToken);
          onTokensUpdated?.(result.accessToken);
          return result.accessToken;
        }

        if (result.kind === 'transient' && attempt < REFRESH_WAKE_UP_RETRY_DELAYS_MS.length) {
          await sleep(REFRESH_WAKE_UP_RETRY_DELAYS_MS[attempt]);
          continue;
        }

        // Rejet explicite du serveur (ou panne réseau qui persiste après
        // tous les essais) — le refresh token est à usage unique et révoqué
        // dès qu'il sert : si un autre onglet (ou la PWA installée, qui
        // partage le même localStorage) l'a déjà utilisé avec succès entre
        // notre lecture et notre appel, le nôtre est rejeté alors que la
        // session reste parfaitement valide — un nouveau token est déjà
        // écrit en localStorage. On ne déconnecte que si ce n'est vraiment
        // pas le cas, sinon on adopte silencieusement celui que l'autre a posé.
        const currentRefresh = localStorage.getItem(REFRESH_KEY);
        if (currentRefresh && currentRefresh !== refreshToken) {
          const currentAccess = localStorage.getItem(TOKEN_KEY);
          onTokensUpdated?.(currentAccess);
          return currentAccess;
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        onTokensUpdated?.(null);
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * L'instance Render gratuite s'endort après inactivité : le premier appel
 * peut échouer (connexion refusée pendant le démarrage) ou renvoyer la
 * page d'attente HTML de Render au lieu du JSON attendu, avant que l'API
 * soit vraiment prête (~30-50s). Sans retry, l'utilisateur devait
 * recharger la page et resaisir ses identifiants pour qu'une seconde
 * tentative, plus tardive, réussisse.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  retried = false,
  wakeAttempt = 0,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    if (wakeAttempt < WAKE_UP_RETRY_DELAYS_MS.length) {
      await sleep(WAKE_UP_RETRY_DELAYS_MS[wakeAttempt]);
      return request<T>(path, options, token, retried, wakeAttempt + 1);
    }
    throw new ApiError(0, 'Le serveur ne répond pas — vérifiez votre connexion et réessayez.');
  }

  if (res.status === 401 && token && !retried) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, newToken, true, wakeAttempt);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Erreur réseau', body);
  }

  if (res.status === 204) return undefined as T;

  try {
    const text = await res.text();
    // Un contrôleur qui renvoie null/undefined produit un corps 200 vide
    // (Content-Length: 0) — un cas normal, pas une page d'attente Render.
    if (text === '') return undefined as T;
    return JSON.parse(text) as T;
  } catch {
    // Réponse 200 mais pas du JSON : page d'attente de Render pendant le réveil.
    if (wakeAttempt < WAKE_UP_RETRY_DELAYS_MS.length) {
      await sleep(WAKE_UP_RETRY_DELAYS_MS[wakeAttempt]);
      return request<T>(path, options, token, retried, wakeAttempt + 1);
    }
    throw new ApiError(0, 'Le serveur démarre encore — réessayez dans quelques secondes.');
  }
}

/**
 * Un lien <a href> direct vers l'API ne peut pas porter le token JWT
 * (le navigateur n'envoie que des cookies lors d'une navigation) — d'où le
 * "401 Unauthorized" quand on cliquait "Voir le PDF". On récupère donc le
 * PDF via fetch (avec l'en-tête Authorization), puis on l'ouvre depuis un
 * blob local.
 */
async function requestBlob(path: string, token?: string | null, retried = false): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401 && token && !retried) {
    const newToken = await refreshAccessToken();
    if (newToken) return requestBlob(path, newToken, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Erreur réseau');
  }

  return res.blob();
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { method: 'GET' }, token),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }, token),
  put: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }, token),
  delete: <T>(path: string, token?: string | null, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }, token),
  getBlob: requestBlob,
};
