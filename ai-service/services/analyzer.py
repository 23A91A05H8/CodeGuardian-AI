"""
Core analysis orchestration for CodeGuardian AI.

For each analysis type: build the prompt, try watsonx.ai, normalize whatever the
model returns into the strict schema, and - if anything goes wrong at any stage -
fall back to a deterministic heuristic analyzer so the user always gets a result.
The reason for a fallback is returned so the UI can explain it.
"""
import logging
import re
from typing import List, Optional, Tuple

from models.schemas import CodeRequest, QualityScore
from services import watsonx
from services.normalize import normalize_result
from services.prompts import PROMPT_MAP

logger = logging.getLogger("codeguardian.analyzer")


# --------------------------------------------------------------------------- language

def detect_language(code: str, hint: Optional[str] = "auto") -> str:
    if hint and hint.strip().lower() not in ("auto", "unknown", ""):
        return hint.strip()

    if "<!DOCTYPE html>" in code or ("<html" in code and "</html>" in code):
        return "html"
    if "#include <" in code or re.search(r"\bint\s+main\s*\(", code):
        return "cpp"
    if "public class" in code or "System.out.println" in code or "public static void main" in code:
        return "java"
    if re.search(r"\bpackage\s+main\b|^\s*func\s+\w+\s*\(", code, re.M):
        return "go"
    if re.search(r"\bfn\s+\w+\s*\(|\blet\s+mut\s+|\bimpl\s+\w+", code):
        return "rust"
    # Python: def/class with a trailing colon, "import x" without quotes/from-'module', etc.
    if (re.search(r"^\s*(?:async\s+)?def\s+\w+\s*\(.*\)\s*(?:->\s*[^:]+)?:\s*$", code, re.M)
            or re.search(r"^\s*class\s+\w+(?:\(.*\))?:\s*$", code, re.M)
            or re.search(r"^\s*(?:import\s+[\w.]+\s*$|from\s+[\w.]+\s+import\s+)", code, re.M)
            or re.search(r"^\s*(?:elif\b|if __name__)", code, re.M)):
        return "python"
    if re.search(r"\binterface\s+\w+\s*\{|\btype\s+\w+\s*=|:\s*(?:string|number|boolean|any|void)\b|\bas\s+const\b", code):
        return "typescript"
    if re.search(r"\b(?:function|const|let|var|console\.log|require\()|=>", code):
        return "javascript"
    return "unknown"


# --------------------------------------------------------------------------- orchestration

def _run(analysis_type: str, req: CodeRequest) -> Tuple[dict, bool, Optional[str]]:
    """Returns (result_dict, mock_mode_flag, fallback_reason)."""
    language = detect_language(req.code, req.language)
    prompt = PROMPT_MAP[analysis_type].format(code=req.code, language=language)

    raw, reason = watsonx.generate_json(prompt)
    if raw is not None:
        try:
            return normalize_result(analysis_type, raw), False, None
        except ValueError as exc:
            reason = f"watsonx.ai returned an unusable response: {exc}."
            logger.warning(reason)

    return _mock(analysis_type, req, language), True, reason


def analyze(analysis_type: str, req: CodeRequest) -> Tuple[dict, bool, Optional[str]]:
    return _run(analysis_type, req)


def compute_quality_score(code: str, issue_count: int = 0, high_severity_count: int = 0) -> QualityScore:
    lines = [l for l in code.splitlines() if l.strip()]
    n = max(len(lines), 1)

    length_penalty = min(15, n // 40)
    comment_lines = len([l for l in lines if l.strip().startswith(("#", "//", "/*", "*"))])
    comment_bonus = min(10, int((comment_lines / n) * 40))
    issue_penalty = min(50, issue_count * 6 + high_severity_count * 10)

    score = max(0, min(100, 100 - length_penalty - issue_penalty + comment_bonus))
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


# --------------------------------------------------------------------------- heuristics

def _line_of(code: str, pattern: str, flags: int = 0) -> Optional[int]:
    match = re.search(pattern, code, flags)
    if not match:
        return None
    return code.count("\n", 0, match.start()) + 1


def _issue(title, severity, description, recommendation, line=None) -> dict:
    return {"title": title, "severity": severity, "description": description,
            "line": line, "recommendation": recommendation}


# (title, severity, regex, flags, description, recommendation)
_BUG_RULES = [
    ("Bare except clause", "medium", r"^\s*except\s*:", re.M,
     "A bare 'except:' swallows every exception, including KeyboardInterrupt and SystemExit.",
     "Catch specific exception types and log or re-raise unexpected ones."),
    ("Mutable default argument", "high", r"def\s+\w+\([^)]*=\s*(?:\[\]|\{\}|set\(\))", 0,
     "A mutable default argument is created once and shared between calls, causing surprising state leaks.",
     "Default to None and create the list/dict inside the function."),
    ("Async callback inside forEach", "high", r"\.forEach\(\s*async\b", 0,
     "Array.forEach does not await async callbacks, so the code after it runs before the work finishes.",
     "Use 'for...of' with await, or 'await Promise.all(items.map(async ...))'."),
    ("Division by zero", "high", r"(?<![/*])/(?![/*])\s*0(?![\w.])", 0,
     "The code divides by a literal zero, which raises an error (Python) or yields Infinity/NaN (JS).",
     "Guard the divisor or remove the dead expression."),
    ("Empty catch/except block", "medium", r"catch\s*(?:\([^)]*\))?\s*\{\s*(?://[^\n]*)?\s*\}|except[^\n]*:\s*\n\s*pass\b", 0,
     "Errors are caught and silently ignored, hiding failures and making debugging very hard.",
     "Log the error or handle it explicitly; only ignore errors deliberately and with a comment."),
    ("Loose equality comparison", "low", r"[^=!<>]==[^=]", 0,
     "In JavaScript '==' performs type coercion, which can produce unexpected matches.",
     "Prefer strict equality ('===' / '!==')."),
    ("Use of 'var'", "low", r"^\s*var\s+\w+", re.M,
     "'var' is function-scoped and hoisted, which leads to subtle scoping bugs.",
     "Use 'const' or 'let'."),
    ("Unresolved TODO/FIXME", "low", r"\b(?:TODO|FIXME|XXX)\b", 0,
     "The code contains TODO/FIXME markers indicating incomplete logic.",
     "Resolve these or track them in an issue before shipping."),
]

# Rules that only make sense for particular languages (everything else applies everywhere).
_RULE_LANGS = {
    "Bare except clause": {"python"},
    "Mutable default argument": {"python"},
    "Async callback inside forEach": {"javascript", "typescript"},
    "Loose equality comparison": {"javascript", "typescript"},
    "Use of 'var'": {"javascript", "typescript"},
}

_LANG_ALIASES = {"js": "javascript", "node": "javascript", "ts": "typescript", "py": "python",
                 "c++": "cpp", "cc": "cpp", "cxx": "cpp", "c": "c", "golang": "go"}


def _canon_lang(language: str) -> str:
    lang = (language or "").strip().lower()
    return _LANG_ALIASES.get(lang, lang)


def _rule_applies(title: str, language: str) -> bool:
    allowed = _RULE_LANGS.get(title)
    return allowed is None or _canon_lang(language) in allowed


_SECURITY_RULES = [
    ("Possible SQL Injection", "critical",
     r"(?:SELECT|INSERT|UPDATE|DELETE)\b[^\n]*[\"']\s*\+\s*\w+|(?:SELECT|INSERT|UPDATE|DELETE)\b[^\n]*%s[^\n]*%\s*\(?\w+|f[\"'](?:SELECT|INSERT|UPDATE|DELETE)\b[^\n]*\{|\.format\([^\n]*\)[^\n]*(?:SELECT|INSERT)|(?:SELECT|INSERT|UPDATE|DELETE)\b[^\n]*\$\{",
     re.I,
     "A SQL query appears to be assembled from user-controlled values via string concatenation/formatting.",
     "Use parameterized queries / prepared statements or an ORM."),
    ("Hardcoded credential", "high",
     r"(?:api[_-]?key|secret|passwd|password|token)\s*[:=]\s*[\"'][^\"'\s]{4,}[\"']", re.I,
     "A secret or credential appears to be hardcoded in the source.",
     "Move secrets to environment variables or a secrets manager and rotate the exposed value."),
    ("Dynamic code execution (eval/exec)", "high", r"\b(?:eval|exec)\s*\(", 0,
     "eval/exec on non-constant input allows arbitrary code injection.",
     "Avoid eval/exec; use safe parsers (e.g. json.loads, ast.literal_eval)."),
    ("Unsafe C string function (buffer overflow risk)", "high",
     r"\b(?:strcpy|strcat|sprintf|vsprintf|gets)\s*\(|\bscanf\s*\(\s*\"[^\"]*%s", 0,
     "These functions copy or read data without checking the destination size, a classic buffer overflow.",
     "Use bounded alternatives: strncpy/strlcpy, snprintf, fgets, std::string, or std::vector."),
    ("Shell command injection risk", "high",
     r"os\.system\(|\bsystem\s*\(|shell\s*=\s*True|child_process\.exec\(|subprocess\.(?:call|run|Popen)\([^)]*\+", 0,
     "Commands are built as shell strings, so untrusted input can inject extra commands.",
     "Pass arguments as a list without shell=True and validate all input."),
    ("Unsafe deserialization", "high", r"pickle\.loads?\(|yaml\.load\((?![^)]*Loader\s*=\s*yaml\.SafeLoader)", 0,
     "Deserializing untrusted data with pickle/yaml.load can execute arbitrary code.",
     "Use JSON or yaml.safe_load for untrusted input."),
    ("Cross-site scripting (XSS) risk", "high", r"\.innerHTML\s*=|dangerouslySetInnerHTML|document\.write\(", 0,
     "Writing unsanitized data into the DOM allows script injection.",
     "Use textContent or sanitize with a vetted library such as DOMPurify."),
    ("Weak hashing algorithm", "medium", r"\b(?:md5|sha1)\b", re.I,
     "MD5/SHA-1 are cryptographically broken and unsuitable for passwords or integrity checks.",
     "Use bcrypt/argon2 for passwords and SHA-256+ for integrity."),
    ("TLS verification disabled", "high", r"verify\s*=\s*False|rejectUnauthorized\s*:\s*false", 0,
     "Disabling certificate verification exposes connections to man-in-the-middle attacks.",
     "Keep TLS verification enabled and trust the right CA instead."),
]


def _leak_line(code: str, language: str) -> Optional[int]:
    """Line of an allocation that is never released (C/C++ only)."""
    if _canon_lang(language) not in ("c", "cpp"):
        return None
    smart = r"\bunique_ptr\b|\bshared_ptr\b|\bmake_unique\b|\bmake_shared\b"
    if re.search(r"\bnew\s+[\w:]", code) and not re.search(r"\bdelete\b|" + smart, code):
        return _line_of(code, r"\bnew\s+[\w:]")
    if re.search(r"\b(?:malloc|calloc|realloc)\s*\(", code) and not re.search(r"\bfree\s*\(", code):
        return _line_of(code, r"\b(?:malloc|calloc|realloc)\s*\(")
    return None


def _mock_bugs(code: str, language: str) -> dict:
    issues: List[dict] = []
    for title, severity, pattern, flags, description, recommendation in _BUG_RULES:
        if not _rule_applies(title, language):
            continue
        line = _line_of(code, pattern, flags)
        if line is not None:
            issues.append(_issue(title, severity, description, recommendation, line))

    leak = _leak_line(code, language)
    if leak is not None:
        issues.append(_issue(
            "Memory allocated but never freed", "high",
            "Memory is allocated with new/malloc but there is no matching delete/free (or smart pointer), so it leaks.",
            "Use std::unique_ptr / std::vector, or release the memory with delete[] / free().", leak))

    if not issues:
        issues.append(_issue(
            "No obvious bugs detected", "low",
            "The built-in heuristic scan found no clear logical or runtime problems. "
            "Connect watsonx.ai credentials for a deeper, model-based review.",
            "Add unit tests covering empty input, null values and boundary conditions."))
    real = [i for i in issues if i["title"] != "No obvious bugs detected"]
    return {"issues": issues,
            "summary": f"Heuristic scan found {len(real)} potential issue(s)." if real
            else "Heuristic scan found no obvious issues."}


def _mock_security(code: str) -> dict:
    issues: List[dict] = []
    for title, severity, pattern, flags, description, recommendation in _SECURITY_RULES:
        line = _line_of(code, pattern, flags)
        if line is not None:
            issues.append(_issue(title, severity, description, recommendation, line))

    order = ["low", "medium", "high", "critical"]
    overall = max((i["severity"] for i in issues), key=order.index) if issues else "low"
    if not issues:
        issues.append(_issue(
            "No high-risk patterns detected", "low",
            "The heuristic scan found no injection, hardcoded-secret or unsafe-eval patterns.",
            "Run a full model-based security review before shipping to production."))
    return {"issues": issues, "overall_risk": overall,
            "summary": f"Security scan complete - overall risk: {overall}."}



_NOT_FUNCTIONS = {"if", "for", "while", "switch", "catch", "return", "else", "sizeof", "do"}


def _extract_functions(code: str) -> List[str]:
    names: List[str] = []
    names += re.findall(r"^\s*(?:async\s+)?def\s+(\w+)", code, re.M)                      # python
    names += re.findall(r"\bfunction\s*\*?\s*(\w+)", code)                                  # javascript
    names += re.findall(r"\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>", code)
    names += re.findall(                                                                   # C / C++ / Java / C#
        r"^[ \t]*(?:[\w:<>,*&\[\]]+[ \t]+)+[*&]*(\w+)[ \t]*\([^;{)]*\)[ \t]*(?:const[ \t]*)?(?:noexcept[ \t]*)?\{",
        code, re.M)
    names += re.findall(r"^[ \t]*func[ \t]+(?:\([^)]*\)[ \t]*)?(\w+)\s*\(", code, re.M)  # go
    return [n for n in dict.fromkeys(names) if n not in _NOT_FUNCTIONS]


def _extract_classes(code: str) -> List[str]:
    return list(dict.fromkeys(re.findall(r"^[ \t]*(?:export\s+)?(?:public\s+)?(?:class|struct|interface)\s+(\w+)", code, re.M)))


def _describe_constructs(code: str) -> List[str]:
    steps: List[str] = []
    loops = len(re.findall(r"\b(?:for|while)\b", code))
    branches = len(re.findall(r"\b(?:if|switch)\b", code))
    if re.search(r"\bmain\s*\(", code):
        steps.append("Execution starts in main()")
    if re.search(r"\b(?:cin|scanf|fgets|getline|input\(|readline|Scanner)\b", code):
        steps.append("Reads input from the user or a stream")
    if re.search(r"\b(?:new\s+[\w:]|malloc|calloc)\b", code):
        steps.append("Allocates memory dynamically")
    if loops:
        steps.append(f"Repeats work using {loops} loop(s)")
    if branches:
        steps.append(f"Makes decisions using {branches} conditional check(s)")
    if re.search(r"\b(?:cout|printf|puts|print\(|console\.log|System\.out)\b", code):
        steps.append("Prints results to the console")
    if re.search(r"\breturn\b", code):
        steps.append("Returns a result to the caller")
    return steps


def _first_function_for_tests(code: str) -> str:
    funcs = [f for f in _extract_functions(code) if f != "main"]
    return funcs[0] if funcs else "target"


def _first_definition(code: str) -> Optional[str]:
    for l in code.splitlines():
        s = l.strip()
        if re.match(r"(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:def|function|class)\s+\w+", s) \
                or re.match(r"(?:export\s+)?const\s+\w+\s*=\s*(?:async\s*)?\(", s):
            return s.rstrip("{:").strip()
    return None


def _first_name(code: str) -> Optional[str]:
    m = re.search(r"(?:def|function|class)\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(", code)
    return next((g for g in m.groups() if g), None) if m else None


def _mock(analysis_type: str, req: CodeRequest, language: str) -> dict:
    code = req.code
    first_def = _first_definition(code)

    if analysis_type == "explain":
        funcs, classes = _extract_functions(code), _extract_classes(code)
        parts = []
        if classes:
            parts.append(f"{len(classes)} type(s) ({', '.join(classes[:4])})")
        if funcs:
            parts.append(f"{len(funcs)} function(s) ({', '.join(funcs[:5])}{'...' if len(funcs) > 5 else ''})")
        n_lines = len([l for l in code.splitlines() if l.strip()])
        purpose = (f"This {language} code ({n_lines} non-empty lines) defines " + " and ".join(parts) + "."
                   if parts else f"This {language} snippet ({n_lines} non-empty lines) contains top-level statements.")

        flow = []
        if funcs:
            flow.append("Defines: " + ", ".join(f"{f}()" for f in funcs[:6]))
        flow += _describe_constructs(code)
        if not flow:
            flow = ["Receives its input", "Executes the core logic", "Produces a result"]

        problems = [f"{i['title']}" + (f" (line {i['line']})" if i.get("line") else "")
                    for i in _mock_bugs(code, language)["issues"] + _mock_security(code)["issues"]
                    if not i["title"].startswith("No ")]
        problems = list(dict.fromkeys(problems)) or ["No obvious problems found by the built-in checks"]
        return {
            "purpose": purpose,
            "logic_flow": flow,
            "dependencies": _guess_imports(code) or ["No external dependencies detected"],
            "potential_problems": problems,
        }

    if analysis_type == "bugs":
        return _mock_bugs(code, language)

    if analysis_type == "security":
        return _mock_security(code)

    if analysis_type == "refactor":
        return {
            "suggestions": [
                "Extract repeated logic into small, named helper functions",
                "Add type hints / TypeScript types for clearer contracts",
                "Replace magic numbers and strings with named constants",
                "Use guard clauses to reduce nesting",
            ],
            "refactored_code": None,
            "rationale": "These changes improve readability and make future changes safer without altering behavior.",
        }

    if analysis_type == "tests":
        name = _first_function_for_tests(code)
        lang = _canon_lang(language)
        framework = {"python": "pytest", "javascript": "jest", "typescript": "jest", "java": "junit",
                     "cpp": "googletest", "c": "googletest"}.get(lang, "generic")
        samples = {
            "pytest": f"import pytest\n\n\ndef test_{name}_basic():\n    # TODO: call {name}() with representative input and assert on the result\n    assert True\n\n\ndef test_{name}_edge_cases():\n    # TODO: empty input, None, boundary values\n    assert True\n",
            "jest": f"describe('{name}', () => {{\n  test('basic behaviour', () => {{\n    // TODO: call {name}() with representative input and assert on the result\n    expect(true).toBe(true);\n  }});\n\n  test('edge cases', () => {{\n    // TODO: empty input, null/undefined, boundary values\n    expect(true).toBe(true);\n  }});\n}});\n",
            "junit": "import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;\n\nclass GeneratedTest {\n    @Test\n    void basicBehaviour() {\n        // TODO: call the method under test and assert on the result\n        assertTrue(true);\n    }\n}\n",
            "googletest": f"#include <gtest/gtest.h>\n// TODO: #include the header that declares {name}()\n\nTEST({name.capitalize()}Test, BasicBehaviour) {{\n    // TODO: call {name}() with representative input\n    // EXPECT_EQ({name}(...), expected);\n    EXPECT_TRUE(true);\n}}\n\nTEST({name.capitalize()}Test, EdgeCases) {{\n    // TODO: zero, negative and very large values\n    EXPECT_TRUE(true);\n}}\n",
            "generic": "// TODO: add tests for the analyzed code\n",
        }
        return {"framework": framework, "test_code": samples[framework],
                "notes": "Starter scaffold generated in demo mode - connect watsonx.ai for tests tailored to your code."}

    if analysis_type == "docs":
        title = first_def or "This module"
        return {
            "documentation": f"## {title}\n\n**Overview**\n\nAuto-generated documentation for the submitted {language} code."
                             + ("\n\n**Functions**\n\n" + "\n".join(f"- `{f}()`" for f in _extract_functions(code)) if _extract_functions(code) else "")
                             + f"\n\n**Usage**\n\n```{language}\n{code[:300]}\n```\n\n**Notes**\n\nConnect watsonx.ai credentials for richer, context-aware documentation.",
            "format": "markdown",
        }

    raise ValueError(f"Unknown analysis type: {analysis_type}")


def _guess_imports(code: str):
    found = re.findall(r"^\s*#\s*include\s*[<\"]([^>\"]+)[>\"]", code, re.M)                  # C / C++
    found += re.findall(r"^\s*import\s+(?:static\s+)?([\w.]+)\s*;", code, re.M)              # Java
    found += re.findall(r"^\s*(?:import|from)\s+([\w.]+)\s*(?:import\b|$)", code, re.M)       # Python
    for a, b in re.findall(r"from\s+['\"]([^'\"]+)['\"]|require\(\s*['\"]([^'\"]+)['\"]\s*\)", code):
        found.append(a or b)                                                               # JS / TS
    return list(dict.fromkeys(found))[:10]
