import { buildInitialUssdCode, getCountryConfig } from "../country-router/country-router";
import { pinManager } from "../pin-manager/pin-manager";
import { parseMtnResponse, type ParseResult } from "./session-parser";
import { buildVoiceResponse } from "../voice-adapter/voice-adapter";
import type { UssdJobPayload } from "../../shared/types/transaction.types";
import { modemPool } from "../../modem/modem-pool";
import { buildMockFinalMessage } from "../../modem/modem-mock";
import { logger } from "../../shared/logger/logger";

/**
 * Exécute une session USSD complète (modem mock ou réel).
 */
export async function runUssdSession(payload: UssdJobPayload): Promise<{
  mtnMessage: string;
  parse: ParseResult;
  voiceResponse: string;
}> {
  const cfg = getCountryConfig(payload.country);
  const lang = cfg.language;
  const useMock =
    process.env.NODE_ENV === "development" || process.env.USE_MOCK_MODEM === "true";

  const { client, release } = await modemPool.acquire(payload.country);
  let mtnMessage = "";
  try {
    await client.connect();
    const initial = buildInitialUssdCode(payload.country, payload.action, payload.params);
    let text = await client.sendUSSD(initial);

    const pinPlain = pinManager.decrypt(payload.encryptedPin);
    pinManager.validate(pinPlain);

    for (const step of cfg.menuFlow) {
      if (step === "ENTER_PIN") {
        text = await client.replyUSSD(pinPlain);
      } else if (step === "CONFIRM") {
        text = await client.replyUSSD("1");
      }
    }

    if (useMock) {
      const failIns =
        payload.action === "transfer" &&
        Math.random() < Number(process.env.MOCK_FAILURE_RATE || 0);
      mtnMessage = buildMockFinalMessage(payload.country, payload.action, payload.params, failIns);
    } else {
      mtnMessage = (text || "").trim() || "Réponse modem vide.";
    }

    const parse = parseMtnResponse(mtnMessage, {
      success: cfg.successKeywords,
      failure: cfg.failureKeywords,
    });

    const voiceResponse = buildVoiceResponse(lang, parse, {
      country: payload.country,
      action: payload.action,
      amount: Number(payload.params.amount ?? 0),
      to: String(payload.params.to ?? ""),
      balance: parse.newBalance,
      currency: cfg.currency,
    });

    return { mtnMessage, parse, voiceResponse };
  } catch (e) {
    logger.error("ussd session error", { err: e });
    throw e;
  } finally {
    try {
      await client.cancelUSSD();
      await client.disconnect();
    } catch {
      /* ignore */
    }
    release();
  }
}
