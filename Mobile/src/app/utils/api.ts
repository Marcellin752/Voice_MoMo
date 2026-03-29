const BASE_URL = 'http://localhost:8000';
const TOKEN_KEY = 'momo.auth.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  console.log(`📡 [API] ${method} ${BASE_URL}${path}`);
  if (token) console.log('🔑 [AUTH] Token JWT présent');
  if (body) console.log('📦 [PAYLOAD]', body);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  console.log(`📨 [RESPONSE] Status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    let errData: any;
    try {
      errData = await res.json();
    } catch {
      errData = { message: res.statusText };
    }
    
    console.error(`❌ [ERROR] ${res.status} ${res.statusText}`);
    console.error('   Details:', errData);
    
    const error = new Error(errData.message || errData.detail || 'Erreur réseau') as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  const data = await res.json() as Promise<T>;
  console.log('✅ [SUCCESS] Réponse complète');
  return data;
}

// Types partagés entre les services
export type ApiUser = { id: string; phone: string };

export type ApiProfile = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;      // non stocké côté backend, champ UI seulement
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
