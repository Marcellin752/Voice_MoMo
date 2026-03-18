const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3001";
const TOKEN_KEY = "momo.token";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  authorized?: boolean;
};

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, authorized = false } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authorized) {
    const token = await ensureAuthToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) errorMessage = payload.error;
    } catch {
      // Keep default error message.
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export async function ensureAuthToken() {
  const existing = getStoredToken();
  if (existing) return existing;

  const payload = await request<{ token: string }>("/api/auth/login", {
    method: "POST",
    body: { phone: "0123456789" },
  });
  setStoredToken(payload.token);
  return payload.token;
}

export async function apiGet<T>(path: string, authorized = false) {
  return request<T>(path, { method: "GET", authorized });
}

export async function apiPost<T>(path: string, body?: unknown, authorized = false) {
  return request<T>(path, { method: "POST", body, authorized });
}

export async function apiPut<T>(path: string, body?: unknown, authorized = false) {
  return request<T>(path, { method: "PUT", body, authorized });
}
