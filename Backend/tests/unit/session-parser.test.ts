import { parseMtnResponse } from "../../src/core/ussd-session/session-parser";

describe("session-parser", () => {
  test("détecte succès FR", () => {
    const r = parseMtnResponse("Transaction réussie. 5000 FCFA envoyés.");
    expect(r.status).toBe("SUCCESS");
  });

  test("détecte échec fonds insuffisants", () => {
    const r = parseMtnResponse("Fonds insuffisants. Solde actuel: 100 FCFA.");
    expect(r.status).toBe("FAILED");
    expect(r.reason).toBe("INSUFFICIENT_FUNDS");
  });

  test("détecte succès EN", () => {
    const r = parseMtnResponse("Transfer successful. New balance 200 NGN.");
    expect(r.status).toBe("SUCCESS");
  });
});
