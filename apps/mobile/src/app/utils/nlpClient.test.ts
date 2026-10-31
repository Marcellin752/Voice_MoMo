/**
 * Client NLP (TODO T-061) : timeout, jeton, 401.
 * Exécuté par Node : `npm test`.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NLP_REQUEST_TIMEOUT_MS, NlpRequestError, requestNlp } from './nlpClient.ts';

const realFetch = globalThis.fetch;
let lastUrl = '';
let lastInit: RequestInit | undefined;

beforeEach(() => {
  lastUrl = '';
  lastInit = undefined;
});
afterEach(() => {
  (globalThis as any).fetch = realFetch;
});

test('envoie le jeton en Authorization et joint le chemin à la base', async () => {
  (globalThis as any).fetch = async (url: string, init: RequestInit) => {
    lastUrl = url;
    lastInit = init;
    return { ok: true, status: 200 };
  };
  await requestNlp('http://nlp.example/', '/api/confirm', {
    method: 'POST',
    token: 'jeton-nlp',
    body: JSON.stringify({ transaction_id: 't1' }),
  });
  assert.equal(lastUrl, 'http://nlp.example/api/confirm');
  assert.equal((lastInit?.headers as Record<string, string>)['Authorization'], 'Bearer jeton-nlp');
});

test('401 : NlpRequestError avec status 401', async () => {
  (globalThis as any).fetch = async () => ({ ok: false, status: 401 });
  await assert.rejects(
    () => requestNlp('http://nlp.example', '/api/voice-command', { token: 'x' }),
    (err: unknown) => {
      assert.ok(err instanceof NlpRequestError);
      assert.equal(err.status, 401);
      return true;
    }
  );
});

test('timeout : abort du fetch et message français', async () => {
  (globalThis as any).fetch = async (_url: string, init: RequestInit) => {
    await new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => {
        const e = new Error('The operation was aborted');
        e.name = 'AbortError';
        reject(e);
      });
    });
    return { ok: true, status: 200 };
  };
  await assert.rejects(
    () => requestNlp('http://nlp.example', '/api/voice-command', { timeoutMs: 20 }),
    (err: unknown) => {
      assert.ok(err instanceof NlpRequestError);
      assert.equal(err.aborted, true);
      assert.match(err.message, /trop de temps/);
      return true;
    }
  );
});

test('constante de timeout : borner l\'attente (pas infini)', () => {
  assert.ok(NLP_REQUEST_TIMEOUT_MS > 0);
  assert.ok(NLP_REQUEST_TIMEOUT_MS <= 180_000);
});
