/**
 * Tests de caractérisation + non-régression du flux OTP de l'API legacy (TODO T-001).
 *
 * Le service est chargé en mode "in-memory" : la base est simulée comme indisponible, donc aucun
 * accès Postgres n'a lieu (db.js n'est jamais chargé). Le chemin SQL de verifyOtp n'est donc PAS
 * couvert ici ; la logique testée (bypass, devCode, logs, usage unique) est commune aux deux modes.
 */

const PHONE = "0197000001";
const FIXED_OTP = "550000"; // Math.random() = 0.5  ->  floor(100000 + 0.5 * 900000)

const SMS_ENV = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "SMS_API_KEY",
  "ALLOW_DEV_OTP",
  "SHOW_OTP_WHEN_SMS_FAILS",
];

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

describe("legacy auth — OTP, mode développement explicite (ALLOW_DEV_OTP=true)", () => {
  beforeEach(() => {
    process.env.ALLOW_DEV_OTP = "true";
  });

  test("accepte 000000", async () => {
    const auth = loadService();
    const session = await auth.verifyOtp(PHONE, "000000");
    expect(typeof session.token).toBe("string");
  });

  test("renvoie devCode quand le SMS n'a pas pu être envoyé", async () => {
    configureSms(false);
    const auth = loadService();
    const res = await auth.sendOtp(PHONE);
    expect(res.success).toBe(true);
    expect(res.devCode).toBe(FIXED_OTP);
  });

  test("ne renvoie pas devCode quand le SMS est bien parti", async () => {
    configureSms(true);
    const auth = loadService();
    const res = await auth.sendOtp(PHONE);
    expect(res.devCode).toBeUndefined();
  });
});

describe("legacy auth — OTP, repli code à l'écran seul (SHOW_OTP_WHEN_SMS_FAILS=true, ADR-0022)", () => {
  beforeEach(() => {
    process.env.SHOW_OTP_WHEN_SMS_FAILS = "true";
  });

  test("renvoie devCode quand le SMS n'a pas pu être envoyé, et ce code ouvre une session", async () => {
    configureSms(false);
    const auth = loadService();
    const res = await auth.sendOtp(PHONE);
    expect(res.success).toBe(true);
    expect(res.devCode).toBe(FIXED_OTP);
    const session = await auth.verifyOtp(PHONE, res.devCode);
    expect(typeof session.token).toBe("string");
  });

  test("aucun fournisseur configuré : devCode aussi (c'est le cas visé)", async () => {
    const auth = loadService();
    const res = await auth.sendOtp(PHONE);
    expect(res.devCode).toBe(FIXED_OTP);
  });

  test("ne renvoie pas devCode quand le SMS est bien parti", async () => {
    configureSms(true);
    const auth = loadService();
    const res = await auth.sendOtp(PHONE);
    expect(res.devCode).toBeUndefined();
  });

  test("le code de test 000000 reste refusé (différence avec ALLOW_DEV_OTP)", async () => {
    const auth = loadService();
    await auth.sendOtp(PHONE);
    await expectStatus(auth.verifyOtp(PHONE, "000000"), 400);
  });
});

describe("legacy auth — PIN par défaut des comptes OTP (TODO T-068)", () => {
  /** Inscrit PHONE par OTP ; le compte reçoit le PIN par défaut "0000". */
  async function signUpByOtp(): Promise<{ auth: any; session: any }> {
    configureSms(true);
    const auth = loadService();
    await auth.sendOtp(PHONE);
    const session = await auth.verifyOtp(PHONE, FIXED_OTP);
    return { auth, session };
  }

  test("un compte créé par OTP n'ouvre pas de session avec le PIN par défaut 0000", async () => {
    const { auth } = await signUpByOtp();
    await expect(auth.login(PHONE, "0000")).rejects.toMatchObject({ status: 401, message: "PIN incorrect." });
  });

  test("le PIN par défaut reçoit exactement la même réponse qu'un PIN faux (pas d'indice)", async () => {
    const { auth } = await signUpByOtp();
    const defaultPin = await auth.login(PHONE, "0000").catch((e: any) => e);
    const wrongPin = await auth.login(PHONE, "1111").catch((e: any) => e);
    expect({ status: defaultPin.status, message: defaultPin.message }).toEqual({
      status: wrongPin.status,
      message: wrongPin.message,
    });
  });

  test("le changement de PIN depuis le PIN par défaut fonctionne toujours, et le nouveau PIN ouvre une session", async () => {
    const { auth, session } = await signUpByOtp();
    const users: any = require("../../legacy/services/users.service"); // même registre de modules que `auth`
    await users.updatePin(session.user.id, "0000", "4321");
    const again = await auth.login(PHONE, "4321");
    expect(typeof again.token).toBe("string");
    await expect(auth.login(PHONE, "0000")).rejects.toMatchObject({ status: 401 });
  });

  test("un PIN personnel choisi à l'inscription par PIN reste utilisable pour login()", async () => {
    const auth = loadService();
    await auth.register("0197000002", "1234", "Test Utilisateur");
    const session = await auth.login("0197000002", "1234");
    expect(typeof session.token).toBe("string");
  });
});
