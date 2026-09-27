import { Router } from "express";
import { register, login, getCurrentUser } from "../controllers/authController";
import { validateBody, registerSchema, loginSchema } from "../middleware/validate";
import { authRateLimiter } from "../middleware/rateLimiter";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", authRateLimiter, validateBody(registerSchema), register);
router.post("/login", authRateLimiter, validateBody(loginSchema), login);
router.get("/me", authMiddleware, getCurrentUser);

export default router;
