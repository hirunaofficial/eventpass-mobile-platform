import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "../generated/prisma/enums.js";

// Read once at startup and fail fast. A missing secret must crash the
// process, not silently sign tokens with `undefined`.
const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
})();

// Augments Express's Request so downstream handlers get `req.userId`
// and `req.userRole` as typed properties rather than `any`.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
    }
  }
}

/**
 * Issues a session token. The ROLE is embedded in the payload, so
 * requireStaff can authorise without a database lookup on every request.
 * Trade-off: a role change only takes effect when the token is reissued.
 */
export function signToken(userId: string, role: UserRole): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: "30d" });
}

/** Gate for any logged-in user: verifies the JWT, attaches id + role. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: UserRole };
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Gate for door staff only. Must be chained AFTER requireAuth, which is
 * what populates `req.userRole`.
 */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (req.userRole !== "staff") {
    res.status(403).json({ error: "Staff access required" });
    return;
  }
  next();
}
