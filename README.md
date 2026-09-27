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
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
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
WATSONX_MODEL_ID=ibm/granite-13b-instruct-v2
```

> If `WATSONX_API_KEY` is left blank, the AI service automatically runs in **mock mode**, returning realistic structured sample analyses so the whole app is fully demoable without IBM credentials. Fill in the watsonx values to switch to live Granite-model inference.

## 🧪 Demo Script

See [`docs/DEMO.md`](docs/DEMO.md) for a step-by-step walkthrough you can use for a live demo or video.

## 📄 License

MIT — see [`LICENSE`](LICENSE).
