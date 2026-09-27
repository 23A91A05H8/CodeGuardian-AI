# Demo Script (5–7 minutes)

1. **Landing page** — show the CodeGuardian AI hero, feature icons, and the "Analyze Code" CTA.
2. **Sign up** — create a demo account (`demo@codeguardian.ai` / any 6+ char password).
3. **Analyzer — Explain Code**
   - Paste a small Python or JS function.
   - Select **Explain Code** → Analyze.
   - Walk through the purpose / logic flow / dependencies / potential problems output and the quality-score ring.
4. **Analyzer — Security Scan**
   - Paste a snippet with a string-concatenated SQL query or a hardcoded API key.
   - Select **Security Scan** → Analyze.
   - Point out severity badges (critical/high/medium/low) and the overall risk summary.
5. **Analyzer — Generate Tests**
   - Same snippet, select **Generate Tests** → show the generated test file (Jest/PyTest depending on detected language).
6. **Dashboard**
   - Show total analyses, security issues found, average quality score, and the recent quality-score bar chart.
7. **History**
   - Open History, click into a past report to show the saved full result via `GET /report/:id`.
8. **Wrap-up**
   - Mention the mock-mode fallback: the whole flow above works identically whether or not IBM watsonx.ai credentials are configured, which is what makes it demoable anywhere.
