"""
CodeGuardian AI — AI Service
FastAPI microservice that fronts IBM watsonx.ai (Granite models) for all
code-analysis modules: explanation, bug detection, security scanning,
refactoring, test generation, and documentation generation.
"""
import time
from collections import defaultdict
from typing import Dict, List

from fastapi import FastAPI, HTTPException, Request, Response, status
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

# CORS Middleware configured from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory sliding window rate limiter
_request_records: Dict[str, List[float]] = defaultdict(list)


@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    # Only rate-limit heavy analysis endpoints
    path = request.url.path
    if path.startswith(("/analyze", "/generate")):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60.0  # 1 minute window
        limit = settings.RATE_LIMIT_PER_MINUTE

        # Clean old records outside the rolling window
        timestamps = [t for t in _request_records[client_ip] if now - t < window]
        _request_records[client_ip] = timestamps

        if len(timestamps) >= limit:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "status": "error",
                    "message": "Rate limit exceeded. Please wait a moment before sending another analysis request.",
                    "limit_per_minute": limit,
                },
            )

        _request_records[client_ip].append(now)

    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err.get("loc", []))
        errors.append({"field": field, "message": err.get("msg")})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"status": "error", "message": "Request validation failed", "errors": errors},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "message": str(exc.detail)},
    )


@app.exception_handler(Exception)
async def general_exception_handler(_request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"status": "error", "message": f"An unexpected error occurred: {str(exc)}"},
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "watsonx_configured": watsonx.is_configured(),
        "model_id": settings.WATSONX_MODEL_ID,
        "mode": "live_watsonx" if watsonx.is_configured() else "demo_mock_heuristic",
    }


def _build_response(analysis_type: str, req: CodeRequest) -> FullAnalysisResponse:
    require_non_empty_code(req.code)
    try:
        result, mock_mode = analyzer.analyze(analysis_type, req)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc

    response = FullAnalysisResponse(analysis_type=analysis_type, mock_mode=mock_mode)

    issue_count = 0
    high_severity = 0

    if analysis_type == "explain":
        response.explanation = ExplanationResult(**result)
    elif analysis_type == "bugs":
        response.bugs = BugReport(**result)
        issue_count = len(response.bugs.issues)
        high_severity = sum(1 for i in response.bugs.issues if i.severity in ("high", "critical"))
    elif analysis_type == "security":
        response.security = SecurityReport(**result)
        issue_count = len(response.security.issues)
        high_severity = sum(1 for i in response.security.issues if i.severity in ("high", "critical"))
    elif analysis_type == "refactor":
        response.refactor = RefactorSuggestion(**result)
    elif analysis_type == "tests":
        response.tests = GeneratedTests(**result)
    elif analysis_type == "docs":
        response.docs = GeneratedDocs(**result)

    response.quality_score = analyzer.compute_quality_score(req.code, issue_count, high_severity)
    return response


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
