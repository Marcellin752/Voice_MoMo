/**
 * Tests de caractérisation + non-régression du flux OTP de l'API legacy (TODO T-001).
 *
 * Le service est chargé en mode "in-memory" : la base est simulée comme indisponible, donc aucun
 * accès Postgres n'a lieu (db.js n'est jamais chargé). Le chemin SQL de verifyOtp n'est donc PAS
 * couvert ici ; la logique testée (bypass, devCode, logs, usage unique) est commune aux deux modes.
 */

const PHONE = "0197000001";
const FIXED_OTP = "550000"; // Math.random() = 0.5  ->  floor(100000 + 0.5 * 900000)

const SMS_ENV = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "SMS_API_KEY", "ALLOW_DEV_OTP"];

let originalFetch: typeof fetch;
let logSpy: jest.SpyInstance;

function loadService(): any {
  jest.resetModules();
  jest.doMock("../../legacy/config/db", () => ({
    query: jest.fn().mockRejectedValue(new Error("no database in unit tests")),
    end: jest.fn(),
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../../legacy/services/auth.service");
}

/** Simule un fournisseur SMS (Twilio) qui accepte ou refuse l'envoi. */
function configureSms(delivers: boolean): void {
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "token";
  process.env.TWILIO_PHONE_NUMBER = "+10000000000";
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: delivers,
    statusText: delivers ? "OK" : "Bad Request",
    json: async () => ({}),
  });
}

async function expectStatus(promise: Promise<unknown>, status: number): Promise<void> {
  await expect(promise).rejects.toMatchObject({ status });
}

beforeAll(() => {
  process.env.BCRYPT_ROUNDS = "4"; // lu au chargement du module : accélère les tests
});

beforeEach(() => {
  for (const k of SMS_ENV) delete process.env[k];
  originalFetch = (global as any).fetch;
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  (global as any).fetch = originalFetch;
  jest.restoreAllMocks();
  for (const k of SMS_ENV) delete process.env[k];
});

describe("legacy auth — OTP, configuration par défaut (ALLOW_DEV_OTP absent)", () => {
  test("rejette le code de test 000000, même pour un numéro qui n'a jamais demandé d'OTP", async () => {
    const auth = loadService();
    await expectStatus(auth.verifyOtp(PHONE, "000000"), 400);
  });

  test("rejette 000000 même si un vrai OTP est en attente pour ce numéro", async () => {
    configureSms(true);
    const auth = loadService();
    await auth.sendOtp(PHONE);
    await expectStatus(auth.verifyOtp(PHONE, "000000"), 400);
  });

  test("échec d'envoi du SMS : erreur 503, aucun code dans la réponse ni dans l'erreur", async () => {
    configureSms(false);
    const auth = loadService();
    const outcome = await auth.sendOtp(PHONE).then(
      (v: unknown) => ({ ok: true, v }),
      (e: any) => ({ ok: false, e })
    );
    expect(outcome.ok).toBe(false);
    expect((outcome as any).e.status).toBe(503);
    expect(JSON.stringify((outcome as any).e.message)).not.toContain(FIXED_OTP);
  });

  test("aucun fournisseur SMS configuré : même comportement fermé (503, pas de devCode)", async () => {
    const auth = loadService();
    await expectStatus(auth.sendOtp(PHONE), 503);
  });

  test("le code OTP n'est jamais écrit dans les logs", async () => {
    configureSms(true);
    const auth = loadService();
    await auth.sendOtp(PHONE);
    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain(FIXED_OTP);
  });

  test("flux normal : l'OTP reçu par SMS ouvre une session", async () => {
    configureSms(true);
    const auth = loadService();
    const sent = await auth.sendOtp(PHONE);
    expect(sent).toEqual({ success: true, message: "Code OTP envoyé par SMS." });
    expect(sent.devCode).toBeUndefined();
    const session = await auth.verifyOtp(PHONE, FIXED_OTP);
    expect(typeof session.token).toBe("string");
    expect(session.user.phone).toBe(PHONE);
  });

  test("un OTP incorrect est refusé, et un OTP déjà utilisé ne sert qu'une fois", async () => {
    configureSms(true);
    const auth = loadService();
    await auth.sendOtp(PHONE);
    await expectStatus(auth.verifyOtp(PHONE, "123456"), 400);
    await auth.verifyOtp(PHONE, FIXED_OTP);
    await expectStatus(auth.verifyOtp(PHONE, FIXED_OTP), 400);
  });
});
