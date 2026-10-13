from typing import List, Optional, Literal
from pydantic import BaseModel, Field

AnalysisType = Literal[
    "explain", "bugs", "security", "refactor", "tests", "docs"
]

Severity = Literal["low", "medium", "high", "critical"]


class CodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=250_000, description="Source code to analyze")
    language: Optional[str] = Field(default="auto", max_length=50, description="Programming language hint")
    filename: Optional[str] = Field(default=None, max_length=255, description="Source filename")


class Issue(BaseModel):
    title: str
    severity: Severity
    description: str
    line: Optional[int] = None
    recommendation: Optional[str] = None


class ExplanationResult(BaseModel):
    purpose: str
    logic_flow: List[str]
    dependencies: List[str]
    potential_problems: List[str]


class BugReport(BaseModel):
    issues: List[Issue]
    summary: str


class SecurityReport(BaseModel):
    issues: List[Issue]
    overall_risk: Severity
    summary: str


class RefactorSuggestion(BaseModel):
    suggestions: List[str]
    refactored_code: Optional[str] = None
    rationale: str


class GeneratedTests(BaseModel):
    framework: str
    test_code: str
    notes: Optional[str] = None


class GeneratedDocs(BaseModel):
    documentation: str
    format: str = "markdown"


class QualityScore(BaseModel):
    score: int = Field(..., ge=0, le=100)
    breakdown: dict


class FullAnalysisResponse(BaseModel):
    analysis_type: AnalysisType
    quality_score: Optional[QualityScore] = None
    explanation: Optional[ExplanationResult] = None
    bugs: Optional[BugReport] = None
    security: Optional[SecurityReport] = None
    refactor: Optional[RefactorSuggestion] = None
    tests: Optional[GeneratedTests] = None
    docs: Optional[GeneratedDocs] = None
    mock_mode: bool = False
    fallback_reason: Optional[str] = None
