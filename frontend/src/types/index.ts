export type AnalysisType = "explain" | "bugs" | "security" | "refactor" | "tests" | "docs";
export type Severity = "low" | "medium" | "high" | "critical";

export interface Issue {
  title: string;
  severity: Severity;
  description: string;
  line?: number | null;
  recommendation?: string | null;
}

export interface QualityScore {
  score: number;
  breakdown: Record<string, unknown>;
}

export interface AnalysisResult {
  analysis_type: AnalysisType;
  mock_mode: boolean;
  fallback_reason?: string | null;
  quality_score?: QualityScore;
  explanation?: {
    purpose: string;
    logic_flow: string[];
    dependencies: string[];
    potential_problems: string[];
  };
  bugs?: { issues: Issue[]; summary: string };
  security?: { issues: Issue[]; overall_risk: Severity; summary: string };
  refactor?: { suggestions: string[]; refactored_code: string | null; rationale: string };
  tests?: { framework: string; test_code: string; notes?: string | null };
  docs?: { documentation: string; format: string };
}

export interface AnalysisRecord {
  _id: string;
  id?: string;
  analysisType: AnalysisType;
  language: string;
  filename?: string;
  qualityScore?: number;
  result: AnalysisResult;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface DashboardStats {
  totalAnalyses: number;
  securityIssuesFound: number;
  generatedTests: number;
  avgQualityScore: number | null;
  recent: { id: string; analysisType: AnalysisType; qualityScore?: number; createdAt: string }[];
}
