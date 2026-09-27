# IBM Bob Usage Documentation

IBM Bob was used as our AI development partner throughout the build of CodeGuardian AI.

## Usage

1. **Project architecture planning** — Used **Plan mode** to lay out the three-service architecture (React frontend, Express backend, FastAPI AI service) and the MongoDB schema before writing code.
2. **Component generation** — Used **Agent mode** to scaffold repeated structures: the six frontend pages, the Express controllers/routes, and the FastAPI prompt templates for each of the six analysis modules.
3. **Code review** — Used **Ask mode** to sanity-check the JWT auth flow, the CORS configuration, and the watsonx.ai prompt formats for reliable JSON output.
4. **Bug fixing** — Used the **Diff approval workflow** to review and accept/reject incremental changes, such as tightening the security-scan regex heuristics and fixing the dashboard's average-score calculation.
5. **Documentation generation** — Used Bob to draft the initial versions of `ARCHITECTURE.md`, `API.md`, and this file, which were then reviewed and edited by the team.
