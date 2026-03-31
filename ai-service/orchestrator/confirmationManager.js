import { randomUUID } from "crypto";

const TTL_MS = 5 * 60 * 1000;

/** @typedef {'idle' | 'awaiting_confirmation' | 'awaiting_pin' | 'awaiting_phone'} VoiceState */

/** @type {Map<string, { state: VoiceState; userId: string; authHeader: string; intent: object | null; updatedAt: number }>} */
const sessions = new Map();

function now() {
  return Date.now();
}

export function pruneSessions() {
  const t = now();
  for (const [id, s] of sessions) {
    if (t - s.updatedAt > TTL_MS) sessions.delete(id);
  }
}

setInterval(pruneSessions, 60_000).unref();

/**
 * @param {string | undefined} sessionId
 * @param {string} userId
 * @param {string} authHeader
 */
export function getOrCreateSession(sessionId, userId, authHeader) {
  pruneSessions();
  const id = sessionId && sessions.has(sessionId) ? sessionId : randomUUID();
  let s = sessions.get(id);
  if (!s) {
    s = {
      state: /** @type {VoiceState} */ ("idle"),
      userId: userId || "",
      authHeader: authHeader || "",
      intent: null,
      updatedAt: now(),
    };
    sessions.set(id, s);
  } else {
    s.updatedAt = now();
    if (userId) s.userId = userId;
    if (authHeader) s.authHeader = authHeader;
  }
  return { id, session: s };
}

export function clearSession(id) {
  sessions.delete(id);
}

export function updateSession(id, patch) {
  const s = sessions.get(id);
  if (!s) return;
  Object.assign(s, patch, { updatedAt: now() });
}
