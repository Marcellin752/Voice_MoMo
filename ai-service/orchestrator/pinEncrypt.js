import { createCipheriv, randomBytes, scryptSync } from "crypto";

function getKey() {
  const hex = process.env.PIN_ENCRYPTION_KEY || "";
  if (hex.length === 64 && /^[0-9a-fA-F]+$/.test(hex)) {
    return Buffer.from(hex, "hex");
  }
  return scryptSync("dev-only-pin-key", "salt", 32);
}

/**
 * Same format as Backend PinManager — never log the argument.
 */
export function encryptPin(pinDigits) {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const enc = Buffer.concat([cipher.update(String(pinDigits), "utf8"), cipher.final()]);
  return `aes256:${iv.toString("hex")}:${enc.toString("hex")}`;
}

export function isValidPin(pin) {
  return /^\d{4,6}$/.test(String(pin || ""));
}
