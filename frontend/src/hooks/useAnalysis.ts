import { useState } from "react";
import api from "../services/api";
import { AnalysisType, AnalysisRecord } from "../types";

/** Turn any axios failure into a message that tells the user what actually went wrong. */
export function describeError(err: any): string {
  if (err?.code === "ECONNABORTED") {
    return "The analysis timed out. Try again, or analyze a smaller snippet.";
  }
  if (!err?.response) {
    return `Cannot reach the backend at ${api.defaults.baseURL}. Make sure it is running and that CLIENT_URL in backend/.env allows this page's address.`;
  }
  const data = err.response.data;
  const parts: string[] = [];
  if (data?.message) parts.push(String(data.message));
  if (Array.isArray(data?.errors) && data.errors.length) {
    parts.push(data.errors.map((e: any) => `${e.field}: ${e.message}`).join("; "));
  } else if (data?.details) {
    parts.push(typeof data.details === "string" ? data.details : JSON.stringify(data.details));
  }
  return parts.join(" - ") || `Analysis failed (HTTP ${err.response.status}). Please try again.`;
}

interface RunAnalysisParams {
  code: string;
  language?: string;
  filename?: string;
  analysisType: AnalysisType;
}

export const useAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisRecord | null>(null);

  const runAnalysis = async (params: RunAnalysisParams) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/analyze", params);
      setResult(data.analysis);
      return data.analysis as AnalysisRecord;
    } catch (err: any) {
      setError(describeError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { runAnalysis, loading, error, result };
};
