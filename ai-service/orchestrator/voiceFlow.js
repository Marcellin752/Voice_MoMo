import { randomUUID } from "crypto";
import { encryptPin, isValidPin } from "./pinEncrypt.js";
import { clearSession, getOrCreateSession, updateSession } from "./confirmationManager.js";

const STT_URL = (process.env.STT_URL || "http://127.0.0.1:5001").replace(/\/$/, "");
const NLU_URL = (process.env.NLU_URL || "http://127.0.0.1:5002").replace(/\/$/, "");
const TTS_URL = (process.env.TTS_URL || "http://127.0.0.1:5003").replace(/\/$/, "");
const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const DEFAULT_COUNTRY = process.env.DEFAULT_VOICE_COUNTRY || "BJ";
const USE_V1_USSD = process.env.USE_V1_USSD === "true";

const PIN_ACTIONS = new Set(["transfer", "withdraw", "billPayment", "airtime"]);

function parseYesNo(text) {
  const t = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\b(non|annul|stop|négatif)\b/.test(t)) return "no";
  if (/\b(oui|confirme|valide|d'accord|ok)\b/.test(t)) return "yes";
  return null;
}

function extractDigits(text) {
  return String(text || "").replace(/\D/g, "");
}

async function postStt(buffer, filename, mime) {
  const blob = new Blob([buffer], { type: mime || "application/octet-stream" });
  const fd = new FormData();
  fd.append("audio", blob, filename || "rec.webm");
  const res = await fetch(`${STT_URL}/transcribe`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`stt_${res.status}`);
  return res.json();
}

async function postNlu(text) {
  const res = await fetch(`${NLU_URL}/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`nlu_${res.status}`);
  return res.json();
}

async function postTtsBuffer(text) {
  const res = await fetch(`${TTS_URL}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`tts_${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function callLegacyVoice(authHeader, command) {
  const res = await fetch(`${BACKEND_URL}/api/voice/command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error(`legacy_${res.status}`);
  return res.json();
}

async function postV1Transaction(authHeader, body) {
  const res = await fetch(`${BACKEND_URL}/api/v1/transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`v1_${res.status}:${err.slice(0, 80)}`);
  }
  return res.json();
}

async function getV1Status(authHeader, jobId) {
  const res = await fetch(`${BACKEND_URL}/api/v1/transaction/${encodeURIComponent(jobId)}/status`, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });
  if (!res.ok) throw new Error(`v1status_${res.status}`);
  return res.json();
}

async function pollV1UntilDone(authHeader, jobId, maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const st = await getV1Status(authHeader, jobId);
    if (st.status === "completed" || st.status === "failed") {
      return st;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { status: "failed", result: { voiceResponse: "Délai dépassé pour la transaction." } };
}

function needsConfirmation(nlu) {
  if (nlu.action === "unknown") return false;
  if (nlu.action === "balance") return false;
  return true;
}

function needsPin(nlu) {
  return PIN_ACTIONS.has(nlu.action);
}

function buildLegacyCommand(nlu) {
  const raw = nlu.raw_text || "";
  if (raw.length > 8) return raw;
  if (nlu.action === "transfer" && nlu.amount != null) {
    const to = nlu.to_resolved || nlu.to || "";
    return `envoie ${nlu.amount} à ${to}`;
  }
  if (nlu.action === "withdraw" && nlu.amount != null) return `retire ${nlu.amount}`;
  if (nlu.action === "airtime" && nlu.amount != null) return `recharge ${nlu.amount}`;
  if (nlu.action === "billPayment") return `paye facture ${nlu.to || ""}`;
  if (nlu.action === "miniStatement")
    return "je veux voir mes dernières transactions sur mobile money";
  return raw || "solde";
}

async function executeIntent(nlu, authHeader, encryptedPin) {
  if (USE_V1_USSD && encryptedPin && needsPin(nlu)) {
    try {
      const sessionTxn = randomUUID();
      const params = {};
      if (nlu.amount != null) params.amount = nlu.amount;
      const to = nlu.to_resolved || nlu.to;
      if (to) params.to = to;
      const body = {
        sessionId: sessionTxn,
        userId: nlu.userId,
        country: DEFAULT_COUNTRY,
        action: nlu.action,
        params,
        encryptedPin,
      };
      const created = await postV1Transaction(authHeader, body);
      const finalSt = await pollV1UntilDone(authHeader, created.jobId);
      const vr = finalSt.result?.voiceResponse || finalSt.result?.mtnMessage || "Opération terminée.";
      return { message: vr };
    } catch {
      /* fall through legacy */
    }
  }
  const cmd = buildLegacyCommand(nlu);
  return callLegacyVoice(authHeader, cmd);
}

/**
 * @param {object} p
 * @param {Buffer} p.audioBuffer
 * @param {string} [p.filename]
 * @param {string} [p.mime]
 * @param {string} p.userId
 * @param {string} [p.sessionId]
 * @param {string} p.authHeader
 */
export async function processVoicePipeline(p) {
  const { id, session } = getOrCreateSession(p.sessionId, p.userId, p.authHeader);

  const wrap = async (textFr) => {
    const buf = await postTtsBuffer(textFr);
    return {
      status: "done",
      sessionId: id,
      audioBase64: buf.toString("base64"),
      transcript: "",
      intent: null,
    };
  };

  try {
    const stt = await postStt(p.audioBuffer, p.filename, p.mime);
    const text = String(stt.text || "").trim();

    if (!p.authHeader) {
      return wrap("Veuillez vous connecter pour utiliser la voix.");
    }

    if (session.state === "awaiting_confirmation") {
      const yn = parseYesNo(text);
      if (yn === "no") {
        clearSession(id);
        const buf = await postTtsBuffer("Transaction annulée.");
        return { status: "done", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent: null };
      }
      if (yn !== "yes") {
        const buf = await postTtsBuffer("Dites oui pour confirmer, ou non pour annuler.");
        return { status: "awaiting_confirmation", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent: session.intent };
      }
      const intent = session.intent;
      if (!intent) {
        clearSession(id);
        return wrap("Session expirée. Recommencez.");
      }
      if (needsPin(intent)) {
        updateSession(id, { state: "awaiting_pin" });
        const buf = await postTtsBuffer("Veuillez dire votre code PIN à voix basse, chiffre par chiffre ou en un bloc.");
        return { status: "awaiting_pin", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent };
      }
      const backend = await executeIntent({ ...intent, userId: p.userId }, p.authHeader, null);
      clearSession(id);
      const msg = backend.message || "C'est fait.";
      const buf = await postTtsBuffer(msg);
      return { status: "done", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent };
    }

    if (session.state === "awaiting_pin") {
      const intent = session.intent;
      if (!intent) {
        clearSession(id);
        return wrap("Session expirée.");
      }
      const digits = extractDigits(text);
      if (!isValidPin(digits)) {
        const buf = await postTtsBuffer("Le PIN doit contenir quatre à six chiffres. Réessayez.");
        return { status: "awaiting_pin", sessionId: id, audioBase64: buf.toString("base64"), transcript: "[redacted]", intent };
      }
      const enc = encryptPin(digits);
      const backend = await executeIntent({ ...intent, userId: p.userId }, p.authHeader, enc);
      clearSession(id);
      const msg = backend.message || "Transaction effectuée.";
      const buf = await postTtsBuffer(msg);
      return { status: "done", sessionId: id, audioBase64: buf.toString("base64"), transcript: "[redacted]", intent };
    }

    if (session.state === "awaiting_phone") {
      const intent = { ...session.intent };
      const digits = extractDigits(text);
      if (digits.length < 8) {
        const buf = await postTtsBuffer("Numéro incomplet. Réessayez.");
        return { status: "awaiting_phone", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent };
      }
      intent.to_resolved = digits;
      updateSession(id, { state: "awaiting_confirmation", intent });
      const nluLike = { ...intent, voice_confirmation: `Envoi vers le ${digits}. Confirmez-vous ?` };
      const buf = await postTtsBuffer(nluLike.voice_confirmation);
      return { status: "awaiting_confirmation", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent: nluLike };
    }

    const nlu = await postNlu(text);
    nlu.userId = p.userId;

    if ((nlu.confidence ?? 0) < 0.7 || nlu.action === "unknown") {
      const buf = await postTtsBuffer("Je n'ai pas compris. Reformulez votre demande.");
      return { status: "done", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent: nlu };
    }

    if (nlu.action === "balance") {
      const backend = await callLegacyVoice(p.authHeader, nlu.raw_text || text);
      const buf = await postTtsBuffer(backend.message || "Solde consulté.");
      clearSession(id);
      return { status: "done", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent: nlu };
    }

    if (nlu.action === "transfer" && !nlu.to_resolved) {
      updateSession(id, { state: "awaiting_phone", intent: nlu });
      const buf = await postTtsBuffer("Je n'ai pas trouvé ce contact. Dites le numéro complet.");
      return { status: "awaiting_phone", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent: nlu };
    }

    if (needsConfirmation(nlu)) {
      updateSession(id, { state: "awaiting_confirmation", intent: nlu });
      const buf = await postTtsBuffer(nlu.voice_confirmation || "Confirmez-vous ?");
      return { status: "awaiting_confirmation", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent: nlu };
    }

    const backend = await executeIntent({ ...nlu, userId: p.userId }, p.authHeader, null);
    clearSession(id);
    const buf = await postTtsBuffer(backend.message || "OK.");
    return { status: "done", sessionId: id, audioBase64: buf.toString("base64"), transcript: text, intent: nlu };
  } catch (e) {
    try {
      const buf = await postTtsBuffer("Un service vocal est temporairement indisponible. Réessayez plus tard.");
      return {
        status: "error",
        sessionId: id,
        audioBase64: buf.toString("base64"),
        transcript: "",
        intent: null,
        error: String(e && e.message ? e.message : e),
      };
    } catch {
      throw e;
    }
  }
}

export async function checkUpstreamHealth() {
  const ping = async (url) => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
      return r.ok ? "ok" : "down";
    } catch {
      return "down";
    }
  };
  const ollamaUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  let ollama = "down";
  try {
    const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    ollama = r.ok ? "ok" : "down";
  } catch {
    ollama = "down";
  }
  const [stt, nlu, tts] = await Promise.all([
    ping(`${STT_URL}/health`),
    ping(`${NLU_URL}/health`),
    ping(`${TTS_URL}/health`),
  ]);
  return { stt, nlu, tts, ollama };
}
