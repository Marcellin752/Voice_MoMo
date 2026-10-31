/**
 * Tests du client HTTP du backend (TODO T-019).
 * Exécutés par Node, sans dépendance : `npm test` (Node >= 22.18, qui exécute le TypeScript nativement).
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// api.ts lit localStorage et fetch : on les simule AVANT de l'importer.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const { request, setApiToken } = await import('./api.ts');

const realFetch = globalThis.fetch;
let sentHeaders: Record<string, string> = {};

/** Simule une réponse HTTP du backend. `body === undefined` => le corps n'est pas du JSON valide. */
function mockResponse(status: number, statusText: string, body?: unknown) {
  (globalThis as any).fetch = async (_url: string, init: { headers: Record<string, string> }) => {
    sentHeaders = init.headers;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      json: async () => {
        if (body === undefined) throw new SyntaxError('Unexpected token < in JSON');
        return body;
      },
    };
  };
}

async function rejection(promise: Promise<unknown>): Promise<Error & { status: number }> {
  try {
    await promise;
  } catch (e) {
    return e as Error & { status: number };
  }
  assert.fail('la requête aurait dû échouer');
}

beforeEach(() => {
  store.clear();
  setApiToken(null);
  sentHeaders = {};
});
afterEach(() => {
  (globalThis as any).fetch = realFetch;
});

test("affiche le champ `error` renvoyé par le backend (PIN incorrect, 409, 429, 503)", async () => {
  for (const [status, message] of [
    [401, 'PIN incorrect.'],
    [409, 'Ce numéro de téléphone est déjà enregistré.'],
    [429, 'Trop de tentatives. Veuillez patienter avant de demander un nouveau code.'],
    [503, "L'envoi du SMS a échoué. Veuillez réessayer dans quelques instants."],
  ] as const) {
    mockResponse(status, 'ignored', { error: message });
    const err = await rejection(request('POST', '/api/auth/login', {}));
    assert.equal(err.message, message);
    assert.equal(err.status, status);
  }
});

test('préfère `error` à `message` quand les deux sont présents', async () => {
  mockResponse(400, 'Bad Request', { error: 'Champ invalide', message: 'autre texte' });
  assert.equal((await rejection(request('GET', '/x'))).message, 'Champ invalide');
});

test('accepte encore un corps { message } (ancien format)', async () => {
  mockResponse(400, 'Bad Request', { message: 'Ancien format' });
  assert.equal((await rejection(request('GET', '/x'))).message, 'Ancien format');
});

test("corps non JSON (ex. page d'erreur d'un proxy) : repli sur le statusText", async () => {
  mockResponse(502, 'Bad Gateway');
  assert.equal((await rejection(request('GET', '/x'))).message, 'Bad Gateway');
});

test("rien d'exploitable (statusText vide, `error` non textuel) : message générique", async () => {
  mockResponse(500, '');
  assert.equal((await rejection(request('GET', '/x'))).message, 'Erreur réseau');
  mockResponse(500, 'Internal Server Error', { error: { code: 1 } });
  assert.equal((await rejection(request('GET', '/x'))).message, 'Erreur réseau');
});

test('échec réseau : message convivial inchangé', async () => {
  (globalThis as any).fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const err = await rejection(request('GET', '/x'));
  assert.match(err.message, /^Impossible de contacter le serveur/);
});

test('succès : renvoie le JSON et envoie le jeton en Authorization', async () => {
  setApiToken('jeton-de-test');
  mockResponse(200, 'OK', { hello: 'monde' });
  assert.deepEqual(await request('GET', '/x'), { hello: 'monde' });
  assert.equal(sentHeaders['Authorization'], 'Bearer jeton-de-test');
});
