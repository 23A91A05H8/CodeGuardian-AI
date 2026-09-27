# API Reference

Base URL (backend): `http://localhost:5000/api`

All endpoints except `/auth/*` and `/health` require:
```
Authorization: Bearer <jwt_token>
```

## Auth

### `POST /auth/register`
```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "s3cret123" }
```
**Response `201`**
```json
{ "token": "<jwt>", "user": { "id": "...", "name": "Ada Lovelace", "email": "ada@example.com" } }
```

### `POST /auth/login`
```json
{ "email": "ada@example.com", "password": "s3cret123" }
```
**Response `200`** — same shape as register.

## Analysis

### `POST /analyze`
```json
{
  "code": "def add(a, b): return a + b",
  "language": "python",
  "filename": "utils.py",
  "analysisType": "explain"
}
```
`analysisType` is one of: `explain | bugs | security | refactor | tests | docs`.

**Response `200`**
```json
{ "analysis": { "_id": "...", "analysisType": "explain", "result": { "...": "..." }, "qualityScore": 88, "createdAt": "..." } }
```

### `POST /analyze/upload` (multipart/form-data)
Fields: `file` (the source file), `analysisType`, optional `language`.

### `GET /history`
Returns the authenticated user's last 100 analyses (code field omitted for brevity).

### `GET /report/:id`
Returns a single full analysis record (including code and full AI result) owned by the requesting user.

### `GET /dashboard`
```json
{
  "totalAnalyses": 12,
  "securityIssuesFound": 4,
  "generatedTests": 3,
  "avgQualityScore": 76,
  "recent": [ { "id": "...", "analysisType": "bugs", "qualityScore": 80, "createdAt": "..." } ]
}
```

## AI Service (internal — called by backend, not the frontend directly)

Base URL: `http://localhost:8000`

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness + whether watsonx.ai is configured |
| POST | `/analyze/code` | Code explanation |
| POST | `/analyze/bugs` | Bug detection |
| POST | `/analyze/security` | Security scan |
| POST | `/analyze/refactor` | Refactoring suggestions |
| POST | `/generate/tests` | Test generation |
| POST | `/generate/docs` | Documentation generation |

Request body for all of the above:
```json
{ "code": "string", "language": "auto|python|javascript|...", "filename": "optional.py" }
```
