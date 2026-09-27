import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { config } from "../config/env";

export interface CustomError extends Error {
  status?: number;
  statusCode?: number;
  code?: number | string;
  errors?: any;
}

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // If headers were already sent, delegate to Express default handler
  if (res.headersSent) {
    return _next(err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError || err.name === "ZodError") {
    const issues = ((err as any).issues || (err as any).errors || []).map((e: any) => ({
      field: Array.isArray(e.path) ? e.path.join(".") : String(e.path || "body"),
      message: e.message,
    }));
    return res.status(400).json({
      message: "Validation failed",
      errors: issues,
    });
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Invalid format for resource identifier '${err.path}'`,
    });
  }

  // Handle Mongoose ValidationError
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors || {}).map((e: any) => e.message);
    return res.status(400).json({
      message: "Data validation error",
      details: messages,
    });
  }

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      message: `An account or record with this ${field} already exists.`,
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid authentication token" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Authentication token has expired. Please log in again." });
  }

  // Handle Axios / external AI service errors
  if (err.isAxiosError) {
    const status = err.response?.status || 502;
    const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
    return res.status(status).json({
      message: "AI service communication error",
      detail,
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const isProd = config.NODE_ENV === "production";

  console.error("Unhandled Application Error:", err);

  return res.status(statusCode).json({
    message: statusCode === 500 && isProd ? "Internal server error occurred" : err.message || "An unexpected error occurred",
    ...(isProd ? {} : { stack: err.stack }),
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    message: `API endpoint '${req.method} ${req.originalUrl}' not found.`,
  });
};
