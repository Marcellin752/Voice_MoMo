/**
 * Erreur métier USSD / modem.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UssdTimeoutError extends AppError {
  constructor(message = "USSD_TIMEOUT") {
    super(message, "USSD_TIMEOUT", 504);
    this.name = "UssdTimeoutError";
  }
}

export class ModemUnavailableError extends AppError {
  constructor(message = "Modem indisponible") {
    super(message, "MODEM_UNAVAILABLE", 503);
    this.name = "ModemUnavailableError";
  }
}
