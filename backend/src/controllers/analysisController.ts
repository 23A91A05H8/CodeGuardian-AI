import { Response, NextFunction } from "express";
import axios from "axios";
import { Analysis } from "../models/Analysis";
import { AuthRequest } from "../middleware/authMiddleware";
import { config } from "../config/env";

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
        timeout: 45000,
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
      const status = error.response?.status || 502;
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "AI microservice unavailable";
      return res.status(status).json({
        message: "AI analysis service failed to process the request",
        details: detail,
      });
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
