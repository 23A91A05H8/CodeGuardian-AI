import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { config } from "../config/env";
import { AuthRequest } from "./authMiddleware";

/**
 * Rate limiter for AI analysis endpoints to prevent resource exhaustion and cost spikes.
 * Uses authenticated user ID if available, otherwise falls back to standard IP generator.
 */
export const aiRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_AI,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    keyGeneratorIpFallback: false,
  },
  keyGenerator: (req: AuthRequest) => {
    return req.userId || ipKeyGenerator(req.ip || "127.0.0.1");
  },
  message: {
    message: "Rate limit exceeded for AI analysis. Please wait a few minutes before trying again.",
    retryAfter: `${Math.ceil(config.RATE_LIMIT_WINDOW_MS / 60000)} minutes`,
  },
});

/**
 * Rate limiter for authentication endpoints (login and register) to mitigate brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_AUTH,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please try again later.",
  },
});
