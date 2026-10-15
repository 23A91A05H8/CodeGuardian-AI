
"""
CodeGuardian AI — AI Service
FastAPI microservice that fronts IBM watsonx.ai (Granite models) for all
code-analysis modules: explanation, bug detection, security scanning,
refactoring, test generation, and documentation generation.
"""
import time
from collections import defaultdict
from typing import Dict, List

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from models.schemas import (
    CodeRequest,
    ExplanationResult,
    BugReport,
    SecurityReport,
    RefactorSuggestion,
    GeneratedTests,
    GeneratedDocs,
    FullAnalysisResponse,
)
from services import analyzer, watsonx
from utils.helpers import require_non_empty_code

app = FastAPI(
    title="CodeGuardian AI — AI Service",
    description="IBM watsonx.ai powered code analysis microservice",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory sliding-window rate limiter
_request_records: Dict[str, List[float]] = defaultdict(list)


@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    # Only rate-limit analysis and generation endpoints.
    path = request.url.path
    if path.startswith(("/analyze", "/generate")):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60.0
        limit = settings.RATE_LIMIT_PER_MINUTE

        # Remove timestamps outside the rolling window.
        timestamps = [
            t for t in _request_records[client_ip]
            if now - t < window
        ]
        _request_records[client_ip] = timestamps

        if len(timestamps) >= limit:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "status": "error",
                    "message": (
                        "Rate limit exceeded. Please wait a moment "
                        "before sending another analysis request."
                    ),
                    "limit_per_minute": limit,
                },
            )

        _request_records[client_ip].append(now)

    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
):
    errors = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err.get("loc", []))
        errors.append({
            "field": field,
            "message": err.get("msg"),
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status": "error",
            "message": "Request validation failed",
            "errors": errors,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": str(exc.detail),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(_request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": (
                f"An unexpected error occurred: {str(exc)}"
            ),
        },
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "watsonx_configured": watsonx.is_configured(),
        "model_id": settings.WATSONX_MODEL_ID,
        "mode": (
            "live_watsonx"
            if watsonx.is_configured()
            else "demo_mock_heuristic"
        ),
    }


def _build_response(
    analysis_type: str, req: CodeRequest
) -> FullAnalysisResponse:
    require_non_empty_code(req.code)

    try:
        result, mock_mode, fallback_reason = analyzer.analyze(
            analysis_type, req
        )

        response = FullAnalysisResponse(
            analysis_type=analysis_type,
            mock_mode=mock_mode,
            fallback_reason=fallback_reason,
        )

        issue_count = 0
        high_severity = 0

        # Build the result corresponding to the requested analysis.
        if analysis_type == "explain":
            response.explanation = ExplanationResult(**result)

        elif analysis_type == "bugs":
            response.bugs = BugReport(**result)
            issues = response.bugs.issues
            issue_count = len(issues)
            high_severity = sum(
                1 for issue in issues
                if issue.severity in ("high", "critical")
            )

        elif analysis_type == "security":
            response.security = SecurityReport(**result)
            issues = response.security.issues
            issue_count = len(issues)
            high_severity = sum(
                1 for issue in issues
                if issue.severity in ("high", "critical")
            )

        elif analysis_type == "refactor":
            response.refactor = RefactorSuggestion(**result)

        elif analysis_type == "tests":
            response.tests = GeneratedTests(**result)

        elif analysis_type == "docs":
            response.docs = GeneratedDocs(**result)

        # Exclude informational placeholder entries from scoring.
        placeholder_titles = {
            "No obvious bugs detected",
            "No high-risk patterns detected",
        }

        # For bug and security reports, score the actual returned issues.
        if analysis_type in ("bugs", "security"):
            report = (
                response.bugs
                if analysis_type == "bugs"
                else response.security
            )

            real_issues = [
                issue for issue in report.issues
                if issue.title not in placeholder_titles
            ]

            issue_count = len(real_issues)
            high_severity = sum(
                1 for issue in real_issues
                if issue.severity in ("high", "critical")
            )

        else:
            # Use bug analysis to estimate code quality in other modes,
            # rather than automatically assigning a perfect score.
            bug_result, _, _ = analyzer.analyze("bugs", req)

            real_issues = [
                issue
                for issue in bug_result.get("issues", [])
                if issue.get("title") not in placeholder_titles
            ]

            issue_count = len(real_issues)
            high_severity = sum(
                1 for issue in real_issues
                if issue.get("severity") in ("high", "critical")
            )

        response.quality_score = analyzer.compute_quality_score(
            req.code,
            issue_count,
            high_severity,
        )

        return response

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
        ) from exc


@app.post("/analyze/code", response_model=FullAnalysisResponse)
def analyze_code(req: CodeRequest):
    return _build_response("explain", req)


@app.post("/analyze/bugs", response_model=FullAnalysisResponse)
def analyze_bugs(req: CodeRequest):
    return _build_response("bugs", req)


@app.post("/analyze/security", response_model=FullAnalysisResponse)
def analyze_security(req: CodeRequest):
    return _build_response("security", req)


@app.post("/analyze/refactor", response_model=FullAnalysisResponse)
def analyze_refactor(req: CodeRequest):
    return _build_response("refactor", req)


@app.post("/generate/tests", response_model=FullAnalysisResponse)
def generate_tests(req: CodeRequest):
    return _build_response("tests", req)


@app.post("/generate/docs", response_model=FullAnalysisResponse)
def generate_docs(req: CodeRequest):
    return _build_response("docs", req)
