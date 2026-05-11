import { useState } from "react";
import { Users, Search, Phone, UserCircle, ChevronRight, AlertCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";

type Contact = {
  name: string[];
  tel: string[];
  email?: string[];
};

type NativeContactPayload = {
  name?: { display: string | null };
  phones?: { number: string | null }[];
  emails?: { address: string | null }[];
};

declare global {
  interface Navigator {
    contacts?: {
      select: (
        properties: string[],
        options?: { multiple?: boolean }
      ) => Promise<Contact[]>;
      getProperties: () => Promise<string[]>;
    };
  }
}

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const isWebContactApiSupported = typeof navigator !== "undefined" && "contacts" in navigator;
  const isNative = Capacitor.isNativePlatform();

  const toUiContacts = (nativeContacts: NativeContactPayload[]): Contact[] =>
    nativeContacts
      .map((entry) => {
        const displayName = entry.name?.display?.trim();
        const phones = (entry.phones ?? [])
          .map((phone) => phone.number?.trim())
          .filter((value): value is string => Boolean(value));
        const emails = (entry.emails ?? [])
          .map((email) => email.address?.trim())
          .filter((value): value is string => Boolean(value));

        return {
          name: [displayName || "Inconnu"],
          tel: phones,
          email: emails,
        };
      })
      .filter((entry) => entry.name.length > 0 && entry.tel.length > 0);

  const syncContactsToBackend = async (uiContacts: Contact[]) => {
    try {
      // Dans Axios ou votre utils réseau, ici c'est en dur ou via environnement
      const nlpApiUrl = (import.meta.env.VITE_NLP_API_URL as string) || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${nlpApiUrl}/api/users/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contacts: uiContacts }),
      });
      
      if (response.ok) {
        console.log("✅ Contacts synchronisés avec le backend NLP");
      }
    } catch (err) {
      console.warn("⚠️ Impossible de synchroniser les contacts au backend", err);
    }
  };

  const loadContacts = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isNative) {
        const { Contacts } = await import("@capacitor-community/contacts");

        const currentPermission = await Contacts.checkPermissions();
        const permission =
          currentPermission.contacts === "granted"
            ? currentPermission
            : await Contacts.requestPermissions();

        if (permission.contacts !== "granted" && permission.contacts !== "limited") {
          setError("Permission refusée. Autorisez l'accès aux contacts dans les paramètres de l'application.");
          return;
        }

        const result = await Contacts.getContacts({
          projection: {
            name: true,
            phones: true,
            emails: true,
          },
        });

        const uiContacts = toUiContacts(result.contacts as NativeContactPayload[]);
        setContacts(uiContacts);
        setLoaded(true);
        syncContactsToBackend(uiContacts);
        return;
      }

      if (!isWebContactApiSupported || !navigator.contacts) {
        setError("L'accès aux contacts n'est pas supporté sur cet environnement.");
        return;
      }

      const props = await navigator.contacts.getProperties();
      const selected = await navigator.contacts.select(
        props.filter((p) => ["name", "tel", "email"].includes(p)),
        { multiple: true }
      );
      setContacts(selected);
      setLoaded(true);
      syncContactsToBackend(selected);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError("Impossible d'accéder aux contacts. Vérifiez les permissions de l'application.");
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = contacts.filter((c) => {
    const name = c.name?.[0]?.toLowerCase() ?? "";
    const tel = c.tel?.[0] ?? "";
    const q = search.toLowerCase();
    return name.includes(q) || tel.includes(q);
  });

  const grouped = filtered.reduce<Record<string, Contact[]>>((acc, c) => {
    const letter = (c.name?.[0]?.[0] ?? "#").toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(c);
    return acc;
  }, {});

  const sortedLetters = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col min-h-full w-full bg-slate-50 dark:bg-[#121212] px-6 py-8 transition-colors duration-300">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Contacts</h1>
        {loaded && (
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Search */}
      {loaded && (
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Rechercher un contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white border border-slate-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#FFCC00]/50 focus:border-[#FFCC00] transition-all shadow-sm"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 mb-6 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Empty / initial state */}
      {!loaded && !error && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 py-16">
          <div className="w-20 h-20 rounded-3xl bg-[#004F71]/10 dark:bg-[#FFCC00]/10 flex items-center justify-center">
            <Users size={36} className="text-[#004F71] dark:text-[#FFCC00]" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">Accéder aux contacts</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-xs">
              Sélectionnez des contacts depuis votre téléphone pour effectuer des transferts rapides.
            </p>
          </div>
          <button
            type="button"
            onClick={loadContacts}
            disabled={loading}
            className="flex items-center gap-2 bg-[#004F71] dark:bg-[#FFCC00] text-white dark:text-[#004F71] font-bold px-8 py-4 rounded-2xl shadow-md shadow-[#004F71]/20 dark:shadow-[#FFCC00]/20 transition-all active:scale-95 disabled:opacity-60"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/40 dark:border-[#004F71]/40 border-t-white dark:border-t-[#004F71] rounded-full animate-spin" />
            ) : (
              <Users size={20} />
            )}
            {loading ? "Chargement..." : "Charger les contacts"}
          </button>
        </div>
      )}

      {/* Contact list */}
      {loaded && filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-white/20 px-4 py-8 text-center text-slate-500 dark:text-zinc-400">
          Aucun contact ne correspond à votre recherche.
        </div>
      )}

      {loaded && filtered.length > 0 && (
        <div className="space-y-6">
          {sortedLetters.map((letter) => (
            <div key={letter}>
              <h3 className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-3 px-2">
                {letter}
              </h3>
              <div className="space-y-2">
                {grouped[letter].map((contact, i) => (
                  <ContactItem key={`${letter}-${i}`} contact={contact} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactItem({ contact }: { contact: Contact }) {
  const name = contact.name?.[0] ?? "Inconnu";
  const tel = contact.tel?.[0] ?? "";

  return (
    <button
      type="button"
      className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1A1A1A] rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 transition-colors hover:border-[#FFCC00]/40 active:scale-[0.99]"
    >
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-[#004F71]/10 dark:bg-[#FFCC00]/10 flex items-center justify-center shrink-0">
          <UserCircle size={24} className="text-[#004F71] dark:text-[#FFCC00]" />
        </div>
        <div className="text-left">
          <p className="font-bold text-slate-900 dark:text-white text-sm">{name}</p>
          {tel && (
            <div className="flex items-center gap-1 mt-0.5">
              <Phone size={11} className="text-slate-400" />
              <span className="text-xs font-medium text-slate-500">{tel}</span>
            </div>
          )}
        </div>
      </div>
      <ChevronRight size={18} className="text-slate-300 dark:text-zinc-600 shrink-0" />
    </button>
  );
}
