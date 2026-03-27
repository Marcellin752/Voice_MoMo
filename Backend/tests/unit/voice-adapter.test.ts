import {
  buildVoiceResponse,
  formatAmountForVoice,
  formatPhoneForVoice,
} from "../../src/core/voice-adapter/voice-adapter";
import type { ParseResult } from "../../src/core/ussd-session/session-parser";

describe("voice-adapter", () => {
  test("format montant FR avec espaces", () => {
    expect(formatAmountForVoice(5000, "fr")).toMatch(/5/);
  });

  test("phrase succès solde non vide", () => {
    const parse: ParseResult = {
      status: "SUCCESS",
      rawMessage: "ok",
      newBalance: 1000,
    };
    const v = buildVoiceResponse("fr", parse, {
      country: "BJ",
      action: "balance",
      balance: 1000,
    });
    expect(v.length).toBeGreaterThan(10);
  });

  test("numéro formaté", () => {
    expect(formatPhoneForVoice("0022961234567", "fr")).toContain("61");
  });
});
