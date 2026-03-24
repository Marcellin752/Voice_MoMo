const BASE_URL = 'http://localhost:3001';
const TOKEN_KEY = 'momo.auth.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
  email: string;
  phone: string;
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
