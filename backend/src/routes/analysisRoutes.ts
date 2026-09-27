import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  analyzeCode,
  getHistory,
  getReportById,
  getDashboardStats,
} from "../controllers/analysisController";
import { validateBody, analyzeSchema, validateObjectIdParam } from "../middleware/validate";
import { aiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer upload config with 2MB file limit and safe storage
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
  },
});

router.use(authMiddleware);

router.post("/analyze", aiRateLimiter, validateBody(analyzeSchema), analyzeCode);
router.get("/history", getHistory);
router.get("/report/:id", validateObjectIdParam("id"), getReportById);
router.get("/dashboard", getDashboardStats);

// Safe file upload analysis endpoint
router.post(
  "/analyze/upload",
  aiRateLimiter,
  upload.single("file"),
  async (req, res, next) => {
    let filePath: string | null = null;
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No source file uploaded" });
      }

      filePath = req.file.path;
      const code = fs.readFileSync(filePath, "utf-8");

      req.body.code = code;
      req.body.filename = req.file.originalname;

      // Validate parsed body against analyzeSchema
      const validated = analyzeSchema.parse(req.body);
      req.body = validated;

      return await analyzeCode(req as any, res, next);
    } catch (err) {
      return next(err);
    } finally {
      // Always cleanup uploaded temporary file to prevent disk exhaustion
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupErr) {
          console.error("Failed to delete temp file:", cleanupErr);
        }
      }
    }
  }
);

export default router;
