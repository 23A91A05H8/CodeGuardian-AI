# 🚀 CodeGuardian AI

**Your intelligent AI partner for understanding, reviewing, and improving codebases.**

CodeGuardian AI is a full-stack AI-powered developer assistant. Paste or upload code and get instant, structured insights: plain-English explanations, bug detection, security scanning, refactoring suggestions, auto-generated tests, and documentation — all backed by IBM watsonx.ai (Granite models).

---

## ✨ Features

| Module | What it does |
|---|---|
| 🧠 Code Explanation | Purpose, logic flow, dependencies, potential problems |
| 🐞 Bug Detection | Logical bugs, runtime errors, edge cases, performance issues |
| 🔒 Security Analysis | Injection risks, auth issues, data leaks, unsafe practices, with severity levels |
| 🛠️ Refactoring Suggestions | Cleaner, more maintainable rewrites with rationale |
| 🧪 Test Case Generation | Ready-to-run unit tests for the submitted code |
| 📄 Documentation Generation | Auto-generated docstrings / README-style docs |
| 📊 Dashboard | Quality score trends, issue-severity breakdown, history |
| 🔐 Auth | JWT-based register/login, per-user analysis history |

## 🏗️ Architecture

```
                 USER
                  |
          React Frontend (Vite + TS + Tailwind)
                  |
             Express API (Node + TS + JWT)
                  |
        -------------------
        |                 |
    MongoDB          AI Service (FastAPI, Python)
   (Users,                |
   Analyses,        IBM watsonx.ai
   Projects,               |
   Reports)         IBM Granite Model
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the detailed breakdown and [`docs/API.md`](docs/API.md) for the full API reference.

## 📂 Repository Structure

```
CodeGuardian-AI/
├── frontend/        React + TypeScript + Tailwind dashboard
├── backend/         Node + Express + TypeScript API + MongoDB
├── ai-service/      Python + FastAPI + IBM watsonx.ai integration
├── docs/            Architecture, API, demo script, IBM Bob usage notes
├── bob_sessions/    Notes/logs from AI-pair-programming sessions
└── docker-compose.yml
```

## 🚀 Quick Start

### Option A — Docker (recommended)

```bash
cp backend/.env.example backend/.env          # optional: defaults work without it
cp ai-service/.env.example ai-service/.env    # optional: add WATSONX_* for live Granite inference
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:5000
- AI Service → http://localhost:8000
- Mongo → localhost:27017

### Option B — Run locally (no Docker)

**1. MongoDB** — run a local instance or use MongoDB Atlas, and set `MONGO_URI` accordingly.

**2. AI Service**
```bash
cd ai-service
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in WATSONX_* values, or leave blank for mock mode
uvicorn main:app --reload --port 8000
```

**3. Backend**
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

**4. Frontend**
```bash
cd frontend
npm install
npm run dev
```

## 🔑 Environment Variables

### backend/.env
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/codeguardian
JWT_SECRET=your_secure_random_secret_here
AI_SERVICE_URL=http://localhost:8000
CLIENT_URL=http://localhost:5173
```

### ai-service/.env
```
WATSONX_API_KEY=
WATSONX_PROJECT_ID=
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-4-h-small
```

> If `WATSONX_API_KEY` is left blank, the AI service automatically runs in **mock mode**, returning realistic structured sample analyses so the whole app is fully demoable without IBM credentials. Fill in the watsonx values to switch to live Granite-model inference.

## 🛠️ Troubleshooting

| Symptom in the Analyzer | Cause & fix |
|---|---|
| *"Cannot reach the backend at …"* | Backend isn't running, or the browser address isn't allowed by CORS. Check `http://localhost:5000/api/health` and make sure `CLIENT_URL` in `backend/.env` matches the address in your browser's URL bar (`localhost` and `127.0.0.1` are both accepted in development). In Docker, `VITE_API_URL` must be `http://localhost:5000/api` (the browser can't resolve the `backend` hostname). |
| *"Cannot reach the AI analysis service …"* (503) | Start the AI service (`uvicorn main:app --port 8000`) and check `AI_SERVICE_URL` in `backend/.env`. |
| Report shows an amber **Demo Mode** badge with a *"Why demo mode?"* note | The AI service couldn't use watsonx.ai and fell back to its built-in heuristic analyzer; the note says why (missing credentials, wrong API key/project ID, model unavailable, unparsable model output). Results are still returned. |
| watsonx.ai "model not found / not supported" | IBM retires models over time (`ibm/granite-13b-instruct-v2` was withdrawn). Use a currently available model, e.g. `WATSONX_MODEL_ID=ibm/granite-4-h-small`, and check IBM's *Foundation model lifecycle* page. Withdrawn IDs in an old `.env` are auto-replaced with a warning in the AI-service log. |
| *"Rate limit exceeded"* | Defaults: 30 analyses / 15 min per user. Tune `RATE_LIMIT_MAX_AI` and `RATE_LIMIT_WINDOW_MS` in `backend/.env`. |
| Registration fails with a validation message | Passwords need 8+ characters including at least one letter and one number. |

Check the health of the whole stack at any time: `GET http://localhost:5000/api/health` reports the database, the AI service, and whether watsonx.ai is live or in demo mode.

## ✅ Running the tests

```bash
cd ai-service && pip install pytest httpx && pytest        # 24 tests (incl. malformed-LLM-output regression tests)
cd backend && npm test                                     # needs a reachable MongoDB
```

## 🧪 Demo Script

See [`docs/DEMO.md`](docs/DEMO.md) for a step-by-step walkthrough you can use for a live demo or video.

## 📄 License

MIT — see [`LICENSE`](LICENSE).
