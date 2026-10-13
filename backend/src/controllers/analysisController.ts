import { Response, NextFunction } from "express";
import axios from "axios";
import { Analysis } from "../models/Analysis";
import { AuthRequest } from "../middleware/authMiddleware";
import { config } from "../config/env";

// LLM calls can take a while; the frontend timeout (130s) is deliberately longer than this.
const AI_TIMEOUT_MS = 120_000;

const ENDPOINT_MAP: Record<string, string> = {
  explain: "/analyze/code",
  bugs: "/analyze/bugs",
  security: "/analyze/security",
  refactor: "/analyze/refactor",
  tests: "/generate/tests",
  docs: "/generate/docs",
};

export const analyzeCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code, language, filename, analysisType } = req.body;

    if (!code || !analysisType) {
      return res.status(400).json({ message: "code and analysisType are required" });
    }

    const endpoint = ENDPOINT_MAP[analysisType];
    if (!endpoint) {
      return res.status(400).json({
        message: `Unknown analysisType '${analysisType}'. Valid types: ${Object.keys(ENDPOINT_MAP).join(", ")}`,
      });
    }

    // Forward to Python AI microservice with timeout
    const aiResponse = await axios.post(
      `${config.AI_SERVICE_URL}${endpoint}`,
      {
        code,
        language: language || "auto",
        filename: filename || undefined,
      },
      {
        timeout: AI_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = aiResponse.data;
    const computedScore = typeof result?.quality_score?.score === "number" ? result.quality_score.score : undefined;

    const record = await Analysis.create({
      user: req.userId,
      filename: filename || undefined,
      language: language || "auto",
      analysisType,
      code,
      result,
      qualityScore: computedScore,
    });

    return res.status(200).json({ analysis: record });
  } catch (error: any) {
    if (error.isAxiosError) {
      const upstreamStatus: number | undefined = error.response?.status;
      const upstream = error.response?.data;
      const detail =
        (typeof upstream === "object" && (upstream?.detail || upstream?.message)) ||
        error.message ||
        "AI microservice unavailable";

      // Never forward upstream 401/403: the browser would interpret it as "session expired" and log the user out.
      let status = 502;
      let message = "The AI analysis service failed to process the request.";
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        status = 504;
        message = "The AI analysis service timed out. Try again, or analyze a smaller snippet.";
      } else if (!error.response) {
        status = 503;
        message = `Cannot reach the AI analysis service at ${config.AI_SERVICE_URL}. Is it running?`;
      } else if (upstreamStatus === 429) {
        status = 429;
        message = "The AI analysis service is rate limiting requests. Please wait a moment and retry.";
      } else if (upstreamStatus === 400 || upstreamStatus === 422) {
        status = 400;
        message = "The AI analysis service rejected the submitted code.";
      }
      console.error(`[analyze] AI service error (${upstreamStatus ?? error.code}):`, detail);
      return res.status(status).json({ message, details: typeof detail === "string" ? detail : JSON.stringify(detail) });
    }
    return next(error);
  }
};

export const getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const records = await Analysis.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-code");

    return res.json({ history: records });
  } catch (error) {
    return next(error);
  }
};

export const getReportById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await Analysis.findOne({ _id: req.params.id, user: req.userId });
    if (!record) {
      return res.status(404).json({ message: "Analysis report not found or access denied." });
    }
    return res.json({ analysis: record });
  } catch (error) {
    return next(error);
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const records = await Analysis.find({ user: req.userId }).sort({ createdAt: 1 });
    const totalAnalyses = records.length;

    const securityIssuesFound = records
      .filter((r) => r.analysisType === "security")
      .reduce((sum, r: any) => sum + (r.result?.security?.issues?.length || 0), 0);

    const generatedTests = records.filter((r) => r.analysisType === "tests").length;

    const scoredRecords = records.filter((r) => typeof r.qualityScore === "number");
    const avgQualityScore = scoredRecords.length
      ? Math.round(scoredRecords.reduce((a, b) => a + (b.qualityScore as number), 0) / scoredRecords.length)
      : null;

    // Last 10 records ordered oldest to newest for chronological chart representation
    const recentTen = records.slice(-10).map((r) => ({
      id: r.id,
      analysisType: r.analysisType,
      qualityScore: r.qualityScore,
      createdAt: r.createdAt,
    }));

    return res.json({
      totalAnalyses,
      securityIssuesFound,
      generatedTests,
      avgQualityScore,
      recent: recentTen,
    });
  } catch (error) {
    return next(error);
  }
};
