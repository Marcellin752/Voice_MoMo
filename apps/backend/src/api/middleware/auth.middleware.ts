import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Valide le JWT Bearer (même secret que l’API legacy).
 */
export function authJwt(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Token manquant." });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: "Configuration JWT manquante." });
      return;
    }
    const decoded = jwt.verify(token, secret) as { userId: string; phone: string };
    req.user = { userId: decoded.userId, phone: decoded.phone };
    next();
  } catch {
    res.status(401).json({ error: "Token invalide." });
  }
}
