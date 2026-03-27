import { logger } from "../shared/logger/logger";
import { UssdTimeoutError } from "../shared/errors/app-errors";
import type { IModemClient } from "./modem.types";

const COMMAND_TIMEOUT = Number(process.env.USSD_COMMAND_TIMEOUT) || 5000;

/**
 * Extrait le texte d'une ligne +CUSD: n,"message",dcs
 */
export function parseCusdLine(line: string): string | null {
  const m = line.match(/\+CUSD:\s*\d+,"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  return m[1].replace(/\\"/g, '"');
}

/**
 * Client modem GSM via port série (AT+CUSD). Le PIN en clair ne doit être utilisé que dans {@link replyUSSD}.
 */
export class ModemClient implements IModemClient {
  private port: import("serialport").SerialPort | null = null;
  private SerialPort: typeof import("serialport").SerialPort | null = null;

  constructor(
    private readonly portPath: string,
    readonly simCountry: string
  ) {}

  async connect(): Promise<void> {
    const { SerialPort } = await import("serialport");
    this.SerialPort = SerialPort;
    this.port = new SerialPort({ path: this.portPath, baudRate: 115200 });
    await this.runAt("AT", COMMAND_TIMEOUT);
    await this.runAt("AT+CMGF=1", COMMAND_TIMEOUT);
    logger.info("modem connected", { port: this.portPath, country: this.simCountry });
  }

  private async runAt(cmd: string, timeoutMs: number): Promise<string> {
    const port = this.port;
    if (!port) throw new Error("Modem non connecté.");
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new UssdTimeoutError()), timeoutMs);
      const buf: string[] = [];
      const onData = (chunk: Buffer) => {
        buf.push(chunk.toString());
        const s = buf.join("");
        if (s.includes("OK") || s.includes("ERROR")) {
          clearTimeout(t);
          port.off("data", onData);
          resolve(s);
        }
      };
      port.write(cmd + "\r");
      port.on("data", onData);
    });
  }

  async sendUSSD(code: string): Promise<string> {
    const raw = await this.runAt(`AT+CUSD=1,"${code.replace(/"/g, "")}",15`, COMMAND_TIMEOUT * 5);
    const line = raw.split(/\r?\n/).find((l) => l.includes("+CUSD"));
    return line ? parseCusdLine(line) || raw : raw;
  }

  async replyUSSD(response: string): Promise<string> {
    /** PIN ou choix menu — ne jamais logger la valeur. */
    const safe = response.replace(/"/g, "'");
    const raw = await this.runAt(`AT+CUSD=1,"${safe}",15`, COMMAND_TIMEOUT * 5);
    const line = raw.split(/\r?\n/).find((l) => l.includes("+CUSD"));
    return line ? parseCusdLine(line) || raw : raw;
  }

  async cancelUSSD(): Promise<void> {
    try {
      await this.runAt("AT+CUSD=2", COMMAND_TIMEOUT);
    } catch (e) {
      logger.warn("cancelUSSD failed");
    }
  }

  async isAlive(): Promise<boolean> {
    try {
      await this.runAt("AT", COMMAND_TIMEOUT);
      return true;
    } catch {
      return false;
    }
  }

  async getSignalStrength(): Promise<number> {
    const raw = await this.runAt("AT+CSQ", COMMAND_TIMEOUT);
    const m = raw.match(/\+CSQ:\s*(\d+)/);
    return m ? Math.min(31, parseInt(m[1], 10)) : 0;
  }

  async disconnect(): Promise<void> {
    if (this.port?.isOpen) {
      this.port.close();
    }
    this.port = null;
  }
}
