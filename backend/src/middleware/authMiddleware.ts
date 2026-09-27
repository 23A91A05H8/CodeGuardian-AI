import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required. Bearer token missing." });
  }

  const token = header.split(" ")[1];
  if (!token || !token.trim()) {
    return res.status(401).json({ message: "Authentication token is missing or malformed." });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Invalid token payload." });
    }
    req.userId = decoded.userId;
    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }
    return res.status(401).json({ message: "Invalid or tampered authentication token." });
  }
};
