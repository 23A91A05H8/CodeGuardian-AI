import { useState } from "react";
import api from "../services/api";
import { AnalysisType, AnalysisRecord } from "../types";

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
      const message = err?.response?.data?.message || "Analysis failed. Please try again.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { runAnalysis, loading, error, result };
};
