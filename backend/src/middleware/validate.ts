import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import mongoose from "mongoose";

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const issues = (error.issues || []).map((err: any) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return res.status(400).json({
          message: "Validation failed",
          errors: issues,
        });
      }
      return next(error);
    }
  };
};

export const validateObjectIdParam = (paramName: string = "id") => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: `Invalid format for route parameter '${paramName}'. Must be a valid 24-character hexadecimal ObjectId.`,
      });
    }
    next();
  };
};

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name cannot exceed 60 characters"),
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password cannot exceed 128 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const analyzeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code must not be empty")
    .max(250000, "Code exceeds maximum allowable size (250KB)"),
  analysisType: z.enum(["explain", "bugs", "security", "refactor", "tests", "docs"] as const),
  language: z.string().trim().max(50).optional().default("auto"),
  filename: z.string().trim().max(255).optional(),
});
