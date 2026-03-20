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

const PROFILE_KEY = "momo.profile";
const LANGUAGE_KEY = "momo.language";
const TX_KEY = "momo.transactions";
const PIN_UPDATED_AT_KEY = "momo.pin.updatedAt";

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

export function getLanguage(): "fr" | "en" {
  const value = localStorage.getItem(LANGUAGE_KEY);
  return value === "en" ? "en" : "fr";
}

export function saveLanguage(language: "fr" | "en") {
  localStorage.setItem(LANGUAGE_KEY, language);
}

export function markPinUpdated() {
  localStorage.setItem(PIN_UPDATED_AT_KEY, new Date().toISOString());
}

export function getPinUpdatedAt() {
  return localStorage.getItem(PIN_UPDATED_AT_KEY);
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
