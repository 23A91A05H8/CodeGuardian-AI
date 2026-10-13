"""
Normalization layer between raw LLM output and the strict Pydantic schemas.

LLMs rarely follow a JSON schema perfectly: severities come back capitalised
("High"), line numbers as "N/A", lists as comma-separated strings, keys go
missing, or the whole payload is wrapped in an extra object. Instead of letting
any of that turn into an HTTP 500, every analysis type is coerced here into a
shape that is guaranteed to validate. If the output is unusable (for example an
empty explanation), `ValueError` is raised so the caller can fall back to the
heuristic analyzer with a clear reason.
"""
import json
import re
from typing import Any, Dict, List, Optional

SEVERITY_ORDER = ["low", "medium", "high", "critical"]

_SEVERITY_ALIASES = {
    "critical": "critical", "severe": "critical", "blocker": "critical", "fatal": "critical",
    "high": "high", "major": "high", "error": "high", "important": "high",
    "medium": "medium", "moderate": "medium", "med": "medium", "warning": "medium", "warn": "medium",
    "low": "low", "minor": "low", "info": "low", "informational": "low", "note": "low",
    "trivial": "low", "none": "low", "negligible": "low",
}


def to_severity(value: Any, default: str = "medium") -> str:
    if isinstance(value, str):
        key = value.strip().lower()
        if key in _SEVERITY_ALIASES:
            return _SEVERITY_ALIASES[key]
        for word, mapped in _SEVERITY_ALIASES.items():  # e.g. "High risk"
            if word in key:
                return mapped
    return default


def to_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip() or default
    if isinstance(value, (list, tuple)):
        return "\n".join(to_str(v) for v in value if v is not None).strip() or default
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, indent=2)
    return str(value)


def to_optional_str(value: Any) -> Optional[str]:
    text = to_str(value)
    if not text or text.lower() in {"null", "none", "n/a"}:
        return None
    return text


def to_line(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, float):
        return int(value) if value >= 1 else None
    if isinstance(value, str):
        match = re.search(r"\d+", value)
        if match:
            number = int(match.group())
            return number if number > 0 else None
    return None


def to_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        parts = re.split(r"\n+|(?:(?<=\.)\s+(?=\d+[.)]\s))", value)
        cleaned = [re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", p).strip() for p in parts]
        return [c for c in cleaned if c]
    if isinstance(value, dict):
        return [f"{k}: {to_str(v)}" for k, v in value.items()]
    if isinstance(value, (list, tuple)):
        return [s for s in (to_str(v) for v in value) if s]
    return [str(value)]


def _unwrap(raw: Any, expected_keys: List[str]) -> Any:
    """Unwrap payloads like {"result": {...}} or {"analysis": {...}}."""
    for _ in range(3):
        if not isinstance(raw, dict):
            break
        if any(k in raw for k in expected_keys):
            break
        if len(raw) == 1:
            raw = next(iter(raw.values()))
            continue
        for wrapper in ("result", "analysis", "response", "output", "data"):
            if isinstance(raw.get(wrapper), dict):
                raw = raw[wrapper]
                break
        else:
            break
    return raw


def _normalize_issues(raw_issues: Any) -> List[Dict[str, Any]]:
    if isinstance(raw_issues, dict):
        raw_issues = [raw_issues]
    if not isinstance(raw_issues, (list, tuple)):
        return []

    issues: List[Dict[str, Any]] = []
    for item in raw_issues:
        if isinstance(item, str):
            issues.append({
                "title": item[:80], "severity": "medium", "description": item,
                "line": None, "recommendation": None,
            })
            continue
        if not isinstance(item, dict):
            continue
        title = to_str(item.get("title") or item.get("name") or item.get("issue") or item.get("type"), "Issue")
        description = to_str(item.get("description") or item.get("details") or item.get("message"), title)
        issues.append({
            "title": title,
            "severity": to_severity(item.get("severity") or item.get("risk") or item.get("level")),
            "description": description,
            "line": to_line(item.get("line") or item.get("line_number") or item.get("lineno")),
            "recommendation": to_optional_str(
                item.get("recommendation") or item.get("fix") or item.get("suggestion") or item.get("remediation")
            ),
        })
    return issues


def _max_severity(issues: List[Dict[str, Any]]) -> str:
    if not issues:
        return "low"
    return max((i["severity"] for i in issues), key=SEVERITY_ORDER.index)


def normalize_result(analysis_type: str, raw: Any) -> Dict[str, Any]:
    """Return a dict that validates against the matching Pydantic schema, or raise ValueError."""
    if isinstance(raw, list):
        # A bare list is only meaningful for issue-style analyses.
        if analysis_type in ("bugs", "security"):
            raw = {"issues": raw}
        else:
            raise ValueError("model returned a JSON list instead of an object")

    if analysis_type == "explain":
        raw = _unwrap(raw, ["purpose", "logic_flow"])
    elif analysis_type == "bugs":
        raw = _unwrap(raw, ["issues", "bugs", "findings"])
    elif analysis_type == "security":
        raw = _unwrap(raw, ["issues", "vulnerabilities", "findings", "overall_risk"])
    elif analysis_type == "refactor":
        raw = _unwrap(raw, ["suggestions", "refactored_code"])
    elif analysis_type == "tests":
        raw = _unwrap(raw, ["test_code", "tests", "framework"])
    elif analysis_type == "docs":
        raw = _unwrap(raw, ["documentation", "docs"])

    if not isinstance(raw, dict):
        raise ValueError("model did not return a JSON object")

    if analysis_type == "explain":
        result = {
            "purpose": to_str(raw.get("purpose") or raw.get("summary") or raw.get("description")),
            "logic_flow": to_str_list(raw.get("logic_flow") or raw.get("flow") or raw.get("steps")),
            "dependencies": to_str_list(raw.get("dependencies") or raw.get("imports")),
            "potential_problems": to_str_list(raw.get("potential_problems") or raw.get("problems") or raw.get("issues")),
        }
        if not result["purpose"] and not result["logic_flow"]:
            raise ValueError("model returned an empty explanation")
        if not result["purpose"]:
            result["purpose"] = result["logic_flow"][0]
        return result

    if analysis_type in ("bugs", "security"):
        issues = _normalize_issues(
            raw.get("issues") or raw.get("bugs") or raw.get("vulnerabilities") or raw.get("findings")
        )
        summary = to_str(
            raw.get("summary") or raw.get("overview"),
            f"{len(issues)} issue(s) reported." if issues else "No issues reported.",
        )
        if analysis_type == "bugs":
            return {"issues": issues, "summary": summary}
        overall = raw.get("overall_risk") or raw.get("risk") or raw.get("risk_level")
        return {
            "issues": issues,
            "overall_risk": to_severity(overall, _max_severity(issues)),
            "summary": summary,
        }

    if analysis_type == "refactor":
        suggestions = to_str_list(raw.get("suggestions") or raw.get("improvements") or raw.get("changes"))
        code = to_optional_str(raw.get("refactored_code") or raw.get("code") or raw.get("refactored"))
        if not suggestions and not code:
            raise ValueError("model returned no refactoring suggestions")
        return {
            "suggestions": suggestions,
            "refactored_code": code,
            "rationale": to_str(raw.get("rationale") or raw.get("explanation") or raw.get("reason"),
                                "See the suggestions above."),
        }

    if analysis_type == "tests":
        test_code = to_str(raw.get("test_code") or raw.get("tests") or raw.get("code"))
        if not test_code:
            raise ValueError("model returned no test code")
        return {
            "framework": to_str(raw.get("framework") or raw.get("test_framework"), "unknown"),
            "test_code": test_code,
            "notes": to_optional_str(raw.get("notes") or raw.get("setup")),
        }

    if analysis_type == "docs":
        documentation = to_str(raw.get("documentation") or raw.get("docs") or raw.get("markdown"))
        if not documentation:
            raise ValueError("model returned no documentation")
        return {"documentation": documentation, "format": "markdown"}

    raise ValueError(f"Unknown analysis type: {analysis_type}")
