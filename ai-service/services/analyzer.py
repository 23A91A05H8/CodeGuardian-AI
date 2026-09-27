"""
Core analysis orchestration for CodeGuardian AI.

For each analysis type, builds the right prompt, tries watsonx.ai, and
falls back to a deterministic, heuristic-based mock so the product works
end-to-end even without IBM credentials configured.
"""
import re
from typing import Tuple

from models.schemas import (
    CodeRequest,
    ExplanationResult,
    BugReport,
    Issue,
    SecurityReport,
    RefactorSuggestion,
    GeneratedTests,
    GeneratedDocs,
    QualityScore,
)
from services import watsonx
from services.prompts import PROMPT_MAP


def detect_language(code: str, hint: str = "auto") -> str:
    if hint and hint != "auto":
        return hint
    if re.search(r"^\s*(?:def|class)\s+\w+.*:", code, re.M) or re.search(r"\b(import|from)\s+\w+", code):
        return "python"
    if re.search(r"\b(interface|type\s+\w+\s*=|:\s*(?:string|number|boolean|any))\b", code):
        return "typescript"
    if re.search(r"\b(?:function|const|let|var|console\.log|=>)\b", code) and "{" in code:
        return "javascript"
    if "public class" in code or "System.out.println" in code or "public static void main" in code:
        return "java"
    if re.search(r"\bpackage\s+main\b|func\s+\w+\(", code):
        return "go"
    if re.search(r"\bfn\s+main\(|let\s+mut\s+|impl\s+", code):
        return "rust"
    if "#include <" in code or re.search(r"\bint\s+main\s*\(", code):
        return "cpp"
    if "<!DOCTYPE html>" in code or ("<html" in code and "</html>" in code):
        return "html"
    return "unknown"


def _run(analysis_type: str, req: CodeRequest) -> Tuple[dict, bool]:
    """Returns (result_dict, mock_mode_flag)."""
    language = detect_language(req.code, req.language)
    prompt = PROMPT_MAP[analysis_type].format(code=req.code, language=language)

    result = watsonx.generate_json(prompt)
    if result is not None:
        return result, False

    return _mock(analysis_type, req, language), True


def compute_quality_score(code: str, issue_count: int = 0, high_severity_count: int = 0) -> QualityScore:
    lines = [l for l in code.splitlines() if l.strip()]
    n = max(len(lines), 1)

    length_penalty = min(15, n // 40)
    comment_lines = len([l for l in lines if l.strip().startswith(("#", "//", "/*", "*"))])
    comment_bonus = min(10, int((comment_lines / n) * 40))
    issue_penalty = min(50, issue_count * 6 + high_severity_count * 10)

    score = 100 - length_penalty - issue_penalty + comment_bonus
    score = max(0, min(100, score))

    return QualityScore(
        score=score,
        breakdown={
            "base": 100,
            "length_penalty": -length_penalty,
            "issue_penalty": -issue_penalty,
            "comment_bonus": comment_bonus,
            "lines_analyzed": n,
        },
    )


def _mock(analysis_type: str, req: CodeRequest, language: str) -> dict:
    code = req.code
    lines = code.splitlines()
    first_def = next((l.strip() for l in lines if l.strip().startswith(("def ", "function ", "class ", "public "))), None)

    if analysis_type == "explain":
        return {
            "purpose": (
                f"This {language} snippet defines "
                + (f"'{first_def}'" if first_def else "logic")
                + " and performs a sequence of operations on its inputs."
            ),
            "logic_flow": [
                "Parses/receives input parameters",
                "Executes the core logic (loops, conditionals, or transformations)",
                "Returns or outputs a result",
            ],
            "dependencies": _guess_imports(code) or ["No external dependencies detected"],
            "potential_problems": [
                "No input validation detected for edge cases",
                "Limited inline documentation",
            ],
        }

    if analysis_type == "bugs":
        issues = []
        if "==" not in code and "=" in code and language == "python":
            pass
        if re.search(r"except\s*:\s*$", code, re.M):
            issues.append({
                "title": "Bare except clause",
                "severity": "medium",
                "description": "A bare 'except:' silently swallows all exceptions, including system-exiting ones.",
                "line": None,
                "recommendation": "Catch specific exception types instead of a bare except.",
            })
        if "TODO" in code or "FIXME" in code:
            issues.append({
                "title": "Unresolved TODO/FIXME",
                "severity": "low",
                "description": "The code contains TODO/FIXME markers indicating incomplete logic.",
                "line": None,
                "recommendation": "Resolve or track these before shipping to production.",
            })
        if not issues:
            issues.append({
                "title": "No obvious runtime bugs detected",
                "severity": "low",
                "description": "Static heuristics did not surface clear logical or runtime issues, but full coverage requires live watsonx.ai analysis.",
                "line": None,
                "recommendation": "Add unit tests to validate edge cases such as empty input, nulls, and boundary values.",
            })
        return {"issues": issues, "summary": f"Found {len(issues)} potential issue(s) via heuristic scan."}

    if analysis_type == "security":
        issues = []
        if re.search(r"(SELECT|INSERT|UPDATE|DELETE).*\+\s*\w+", code, re.I):
            issues.append({
                "title": "Possible SQL Injection",
                "severity": "critical",
                "description": "SQL query appears to be built via string concatenation with user input.",
                "line": None,
                "recommendation": "Use parameterized queries / prepared statements or an ORM.",
            })
        if re.search(r"(api[_-]?key|secret|password)\s*=\s*[\"'][^\"']+[\"']", code, re.I):
            issues.append({
                "title": "Hardcoded credential",
                "severity": "high",
                "description": "A secret/credential appears to be hardcoded directly in source.",
                "line": None,
                "recommendation": "Move secrets to environment variables or a secrets manager.",
            })
        if re.search(r"eval\(|exec\(", code):
            issues.append({
                "title": "Use of eval/exec",
                "severity": "high",
                "description": "Dynamic code execution via eval/exec can allow arbitrary code injection.",
                "line": None,
                "recommendation": "Avoid eval/exec on any input that isn't fully trusted and sanitized.",
            })
        overall = "critical" if any(i["severity"] == "critical" for i in issues) else (
            "high" if any(i["severity"] == "high" for i in issues) else ("low" if not issues else "medium")
        )
        if not issues:
            issues.append({
                "title": "No high-risk patterns detected",
                "severity": "low",
                "description": "Heuristic scan found no obvious injection, hardcoded secret, or unsafe-eval patterns.",
                "line": None,
                "recommendation": "Still recommend a full security review with live watsonx.ai analysis for deeper coverage.",
            })
        return {"issues": issues, "overall_risk": overall, "summary": f"Security scan complete — overall risk: {overall}."}

    if analysis_type == "refactor":
        return {
            "suggestions": [
                "Extract repeated logic into small, named helper functions",
                "Add type hints / TypeScript types for clearer contracts",
                "Replace magic numbers/strings with named constants",
                "Add guard clauses to reduce nesting",
            ],
            "refactored_code": None,
            "rationale": "These changes improve readability and make future changes safer without altering behavior.",
        }

    if analysis_type == "tests":
        framework = {"python": "pytest", "javascript": "jest", "java": "junit"}.get(language, "generic")
        sample = {
            "pytest": "import pytest\n\ndef test_example():\n    # TODO: replace with real call into the analyzed function\n    assert True\n",
            "jest": "test('example', () => {\n  // TODO: replace with real call into the analyzed function\n  expect(true).toBe(true);\n});\n",
            "junit": "import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;\n\nclass ExampleTest {\n    @Test\n    void example() {\n        assertTrue(true);\n    }\n}\n",
            "generic": "// TODO: add tests for the analyzed code\n",
        }[framework]
        return {"framework": framework, "test_code": sample, "notes": "Generated as a starting scaffold — connect real assertions to the analyzed function's actual behavior."}

    if analysis_type == "docs":
        title = first_def or "This module"
        return {
            "documentation": f"## {title}\n\n**Overview**\n\nAuto-generated documentation for the submitted {language} code.\n\n**Usage**\n\n```{language}\n{code[:200]}\n```\n\n**Notes**\n\nConnect live watsonx.ai credentials for richer, context-aware documentation.",
            "format": "markdown",
        }

    raise ValueError(f"Unknown analysis type: {analysis_type}")


def _guess_imports(code: str):
    imports = re.findall(r"^\s*(?:import|from|require)\s+([\w\.]+)", code, re.M)
    return list(dict.fromkeys(imports))[:8]


def analyze(analysis_type: str, req: CodeRequest) -> dict:
    result, mock_mode = _run(analysis_type, req)
    return result, mock_mode
