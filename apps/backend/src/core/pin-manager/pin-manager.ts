import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { logger } from "../../shared/logger/logger";

const ALGO = "aes-256-cbc";

function getKey(): Buffer {
  const hex = process.env.PIN_ENCRYPTION_KEY || "";
  if (hex.length === 64 && /^[0-9a-fA-F]+$/.test(hex)) {
    return Buffer.from(hex, "hex");
  }
  // Dérivation déterministe faible pour dev uniquement si clé absente
  logger.warn("PIN_ENCRYPTION_KEY manquant ou invalide — utilisation d'une clé dérivée (dev uniquement).");
  return scryptSync("dev-only-pin-key", "salt", 32);
}

/**
 * Chiffrement / déchiffrement PIN MoMo (AES-256-CBC). Le PIN ne doit jamais être loggé.
 */
export class PinManager {
  /**
   * Chiffre un PIN et retourne `aes256:{iv_hex}:{ciphertext_hex}`.
   */
  encrypt(pin: string): string {
    const key = getKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
    return `aes256:${iv.toString("hex")}:${enc.toString("hex")}`;
  }

  /**
   * Déchiffre une chaîne produite par {@link encrypt} ou formats équivalents.
   */
  decrypt(encrypted: string): string {
    const key = getKey();
    let ivHex: string;
    let ctHex: string;
    const parts = encrypted.split(":");
    if (parts.length >= 3 && parts[0] === "aes256") {
      ivHex = parts[1];
      ctHex = parts.slice(2).join(":");
    } else {
      throw new Error("Format PIN chiffré invalide.");
    }
    const iv = Buffer.from(ivHex, "hex");
    const ciphertext = Buffer.from(ctHex, "hex");
    const decipher = createDecipheriv(ALGO, key, iv);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return plain;
  }

  /** Valide 4 à 6 chiffres. */
  validate(pin: string): boolean {
    return /^\d{4,6}$/.test(pin);
  }
}

export const pinManager = new PinManager();
