/**
 * Client HTTP du service NLP (TODO T-061).
 * Un seul endroit pour l'URL de base, le jeton, le timeout et les 401.
 * Ne pas confondre avec api.ts (backend live).
 */

export const NLP_REQUEST_TIMEOUT_MS = 120_000;

export class NlpRequestError extends Error {
  status?: number;
  aborted?: boolean;
  constructor(message: string, extra?: { status?: number; aborted?: boolean }) {
    super(message);
    this.name = 'NlpRequestError';
    this.status = extra?.status;
    this.aborted = extra?.aborted;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = (baseUrl || '').replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * fetch vers le NLP avec timeout. 401 → NlpRequestError.status = 401 (le hook déconnecte).
 * AbortError → message français, pas un spinner infini.
 */
export async function requestNlp(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    token?: string | null;
    timeoutMs?: number;
  } = {}
): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? NLP_REQUEST_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(joinUrl(baseUrl, path), {
      method: options.method || 'GET',
      headers,
      body: options.body,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === 'AbortError') ||
      (e instanceof Error && e.name === 'AbortError');
    if (aborted) {
      throw new NlpRequestError(
        "Le service vocal met trop de temps à répondre. Réessayez dans un instant.",
        { aborted: true }
      );
    }
    throw new NlpRequestError(
      "Impossible de joindre le service vocal. Vérifiez votre connexion et réessayez."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    throw new NlpRequestError('Session expirée. Veuillez vous reconnecter.', { status: 401 });
  }

  return res;
}
