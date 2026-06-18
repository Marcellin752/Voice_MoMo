import { buildInitialUssdCode, getCountryConfig } from "../../src/core/country-router/country-router";

describe("country-router", () => {
  test("retourne la config BJ", () => {
    const cfg = getCountryConfig("BJ");
    expect(cfg.root).toBe("*880#");
    expect(cfg.currency).toBe("FCFA");
  });

  test("transfert BJ remplace to et amount", () => {
    const code = buildInitialUssdCode("BJ", "transfer", { to: "22961000000", amount: 5000 });
    expect(code).toContain("22961000000");
    expect(code).toContain("5000");
  });

  test("pays inconnu lève une erreur", () => {
    expect(() => getCountryConfig("XX")).toThrow();
  });
});
