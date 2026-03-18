import { apiGet, apiPost, apiPut } from "./apiClient";

export type AppTransaction = {
  id: string;
  title: string;
  desc: string;
  amount: string;
  type: "in" | "out";
  time: string;
  dayLabel: string;
};

type ProfileData = {
  fullName: string;
  email: string;
  phone: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  when: string;
};

const PROFILE_KEY = "momo.profile";
const LANGUAGE_KEY = "momo.language";
const TX_KEY = "momo.transactions";
const PIN_UPDATED_AT_KEY = "momo.pin.updatedAt";
const NOTIFICATIONS_KEY = "momo.notifications";

export function getProfile(): ProfileData {
  const fallback: ProfileData = {
    fullName: "Edwin",
    email: "edwin@example.com",
    phone: "",
  };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProfileData>;
    return {
      fullName: parsed.fullName ?? fallback.fullName,
      email: parsed.email ?? fallback.email,
      phone: parsed.phone ?? fallback.phone,
    };
  } catch {
    return fallback;
  }
}

export function saveProfile(profile: ProfileData) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function fetchProfileFromApi(): Promise<ProfileData> {
  const profile = await apiGet<ProfileData>("/api/users/profile", true);
  saveProfile(profile);
  return profile;
}

export async function updateProfileOnApi(profile: ProfileData): Promise<ProfileData> {
  const updated = await apiPut<ProfileData>("/api/users/profile", profile, true);
  saveProfile(updated);
  return updated;
}

export function getLanguage(): "fr" | "en" {
  const value = localStorage.getItem(LANGUAGE_KEY);
  return value === "en" ? "en" : "fr";
}

export function saveLanguage(language: "fr" | "en") {
  localStorage.setItem(LANGUAGE_KEY, language);
}

export async function fetchLanguageFromApi(): Promise<"fr" | "en"> {
  const payload = await apiGet<{ language: "fr" | "en" }>("/api/users/language", true);
  saveLanguage(payload.language);
  return payload.language;
}

export async function updateLanguageOnApi(language: "fr" | "en") {
  const payload = await apiPut<{ language: "fr" | "en" }>(
    "/api/users/language",
    { language },
    true
  );
  saveLanguage(payload.language);
  return payload.language;
}

export function markPinUpdated() {
  localStorage.setItem(PIN_UPDATED_AT_KEY, new Date().toISOString());
}

export function getPinUpdatedAt() {
  return localStorage.getItem(PIN_UPDATED_AT_KEY);
}

export async function fetchSecurityFromApi() {
  const payload = await apiGet<{ pinUpdatedAt: string | null }>("/api/users/security", true);
  if (payload.pinUpdatedAt) {
    localStorage.setItem(PIN_UPDATED_AT_KEY, payload.pinUpdatedAt);
  }
  return payload;
}

export async function updatePinOnApi(payload: { oldPin: string; newPin: string; confirmPin: string }) {
  const updated = await apiPut<{ pinUpdatedAt: string }>("/api/users/pin", payload, true);
  localStorage.setItem(PIN_UPDATED_AT_KEY, updated.pinUpdatedAt);
  return updated;
}

export function addTransaction(transaction: Omit<AppTransaction, "id" | "time" | "dayLabel">) {
  const now = new Date();
  const tx: AppTransaction = {
    ...transaction,
    id: crypto.randomUUID(),
    time: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    dayLabel: "Aujourd'hui",
  };

  const current = getTransactions();
  localStorage.setItem(TX_KEY, JSON.stringify([tx, ...current]));
}

export async function addTransactionOnApi(input: {
  title: string;
  desc: string;
  amount: number;
  type: "in" | "out";
}) {
  const tx = await apiPost<AppTransaction>("/api/transactions", input, true);
  const current = getTransactions();
  localStorage.setItem(TX_KEY, JSON.stringify([tx, ...current]));
  return tx;
}

export function getTransactions(): AppTransaction[] {
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppTransaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function fetchTransactionsFromApi() {
  const payload = await apiGet<{ transactions: AppTransaction[] }>("/api/transactions", true);
  localStorage.setItem(TX_KEY, JSON.stringify(payload.transactions));
  return payload.transactions;
}

export function getNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NotificationItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function fetchNotificationsFromApi() {
  const payload = await apiGet<{ notifications: NotificationItem[] }>(
    "/api/users/notifications",
    true
  );
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(payload.notifications));
  return payload.notifications;
}
