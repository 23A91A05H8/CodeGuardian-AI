# Architecture

## Overview

CodeGuardian AI is composed of three independently deployable services plus a database:

```
                 USER
                  |
          React Frontend (Vite + TS + Tailwind, port 5173)
                  |  REST (JSON, JWT bearer)
             Express API (Node + TS, port 5000)
                  |
        -------------------
        |                 |
    MongoDB          AI Service (FastAPI, Python, port 8000)
   (Users,                |
   Analyses)        IBM watsonx.ai (Granite model)
```

## Components

### 1. Frontend (`/frontend`)
- **Stack:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide icons.
- **Responsibilities:** authentication UI, code editor / file upload, analysis-type selection, rendering structured AI reports, dashboard visualizations, history browsing.
- **State:** React Context for auth (JWT stored in `localStorage`); component-local state elsewhere. No Redux needed at this scale.

### 2. Backend (`/backend`)
- **Stack:** Node.js, Express, TypeScript, Mongoose (MongoDB), JWT, Multer.
- **Responsibilities:**
  - User registration/login (bcrypt-hashed passwords, JWT issuance).
  - Receiving analysis requests, forwarding them to the AI Service, and persisting results + quality scores to MongoDB (`AnalysisHistory`).
  - Serving history and dashboard aggregate stats per authenticated user.
- **Why a separate layer instead of calling watsonx directly from the frontend?** Keeps API keys server-side, allows persistence/auditing of every analysis, and lets the AI service be swapped or scaled independently.

### 3. AI Service (`/ai-service`)
- **Stack:** Python, FastAPI, `ibm-watsonx-ai` SDK.
- **Responsibilities:** builds the correct prompt for each analysis module (explain / bugs / security / refactor / tests / docs), calls IBM watsonx.ai (Granite model), parses the JSON response, and computes a heuristic code-quality score.
- **Mock mode:** if `WATSONX_API_KEY` / `WATSONX_PROJECT_ID` are unset, the service transparently falls back to deterministic heuristic analyzers (see `services/analyzer.py`) so the product is fully demoable offline. The response includes `"mock_mode": true` in that case so the frontend can surface a banner.

### 4. Database (MongoDB)
Collections:
- **Users** — account credentials (hashed) and profile info.
- **AnalysisHistory** (`Analysis` model) — every analysis run: code, type, language, structured result JSON, quality score, timestamps.
- **Projects** *(reserved for future multi-file project analysis)*.
- **CodeReports** *(the `result` field on `Analysis` currently serves this role; can be split into its own collection if reports grow large)*.

## Data Flow (single analysis request)

1. User pastes/uploads code and picks an analysis type in the **Analyzer** page.
2. Frontend calls `POST /api/analyze` with `{ code, language, filename, analysisType }` and a JWT bearer token.
3. Backend validates the token, maps `analysisType` to the right AI-service endpoint, and forwards the request.
4. AI service detects the language (if not provided), builds the module-specific prompt, and calls watsonx.ai's Granite model — or falls back to mock heuristics.
5. AI service parses the model's JSON response into a typed schema, computes a quality score, and returns it.
6. Backend saves an `Analysis` document and returns it to the frontend.
7. Frontend renders the structured result via `ReportCard` and `ScoreChart`.

## Security Notes
- Passwords are hashed with bcrypt; JWTs expire after 7 days.
- CORS is restricted to `CLIENT_URL` in production.
- All analysis endpoints require a valid JWT.
- Uploaded files are read into memory and deleted from disk immediately after use.
