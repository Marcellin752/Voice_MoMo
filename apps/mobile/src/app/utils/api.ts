const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3001';
const TOKEN_KEY = 'momo.auth.token';

let activeToken: string | null = null;

export function setApiToken(token: string | null) {
  activeToken = token;
}

export function getToken(): string | null {
  return activeToken || localStorage.getItem(TOKEN_KEY);
}


// Le backend Render (offre gratuite) se met en veille après inactivité et peut
// prendre 30s+ à se réveiller. Sans timeout, un fetch() bloqué là-dessus reste
// "en chargement" indéfiniment côté UI, sans jamais échouer ni réussir.
const REQUEST_TIMEOUT_MS = 45000;

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error("Le serveur met trop de temps à répondre. Vérifiez votre connexion et réessayez.");
    }
    throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const error = new Error(err.message || 'Erreur réseau') as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return res.json() as Promise<T>;
}

// Types partagés entre les services
export type ApiUser = { id: string; phone: string };

export type ApiProfile = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  avatarUrl?: string;
  balance?: number;
  currency?: string;
};

export type ApiTransaction = {
  id: string;
  dayLabel: string;
  type: 'in' | 'out' | 'recharge';
  title: string;
  desc: string;
  time: string;
  amount: string;
};

export type ApiNotification = {
  id: string;
  title: string;
  content: string;
  when: string;
};
