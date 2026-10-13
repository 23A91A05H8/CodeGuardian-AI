"""Regression tests: imperfect / failing LLM responses must never produce an HTTP 500."""
import json

import pytest
from fastapi.testclient import TestClient

from main import app
from services import watsonx
from services.analyzer import detect_language
from services.normalize import normalize_result, to_line, to_severity

client = TestClient(app, raise_server_exceptions=False)
CODE = "def f(x):\n    return x / 0"


@pytest.fixture
def fake_model(monkeypatch):
    """Pretend watsonx.ai is configured and returns `text` from the chat endpoint."""
    def install(text=None, error=None):
        class Model:
            def chat(self, messages, params=None):
                if error:
                    raise RuntimeError(error)
                return {"choices": [{"message": {"content": text}}]}
        monkeypatch.setattr(watsonx, "is_configured", lambda: True)
        monkeypatch.setattr(watsonx, "_model", Model())
    return install


def post(route):
    return client.post(route, json={"code": CODE, "language": "python"})


@pytest.mark.parametrize("route,payload", [
    ("/analyze/bugs", {"issues": [{"title": "t", "severity": "High", "description": "d", "line": "N/A"}], "summary": "s"}),
    ("/analyze/bugs", {"issues": []}),
    ("/analyze/bugs", [{"title": "t", "severity": "low", "description": "d"}]),
    ("/analyze/code", {"purpose": "p", "logic_flow": "1. a\n2. b", "dependencies": None, "potential_problems": "none"}),
    ("/analyze/security", {"issues": [{"title": "t", "severity": "moderate", "description": "d"}], "overall_risk": "Moderate"}),
    ("/analyze/refactor", {"suggestions": ["a"], "refactored_code": {"x": 1}, "rationale": "r"}),
    ("/analyze/code", {"result": {"purpose": "p", "logic_flow": ["a"], "dependencies": [], "potential_problems": []}}),
])
def test_imperfect_model_output_is_normalized(fake_model, route, payload):
    fake_model(json.dumps(payload))
    r = post(route)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mock_mode"] is False
    assert body["quality_score"] is not None


def test_fenced_json_with_prose(fake_model):
    fake_model('Sure!\n```json\n{"documentation": "# Docs"}\n```\nDone.')
    r = post("/generate/docs")
    assert r.status_code == 200 and r.json()["docs"]["documentation"] == "# Docs"


def test_raw_newline_in_json_string(fake_model):
    fake_model('{"framework":"pytest","test_code":"def test():\n    assert 1","notes":null}')
    r = post("/generate/tests")
    assert r.status_code == 200 and r.json()["mock_mode"] is False


@pytest.mark.parametrize("text,error", [
    ("I cannot help with that.", None),
    ('{"purpose": "", "logic_flow": []}', None),
    (None, "model ibm/granite-13b-instruct-v2 not supported"),
])
def test_unusable_output_falls_back_with_reason(fake_model, text, error):
    fake_model(text, error)
    r = post("/analyze/code")
    assert r.status_code == 200
    body = r.json()
    assert body["mock_mode"] is True
    assert body["fallback_reason"]
    assert body["explanation"]["purpose"]


def test_demo_mode_reports_reason_without_credentials(monkeypatch):
    monkeypatch.setattr(watsonx, "is_configured", lambda: False)
    body = post("/analyze/code").json()
    assert body["mock_mode"] is True and "not configured" in body["fallback_reason"]


def test_heuristics_flag_real_bugs_with_line_numbers():
    js = "async function f(ids) {\n  ids.forEach(async (id) => {\n    await g(id);\n  });\n}"
    body = client.post("/analyze/bugs", json={"code": js}).json()
    issue = next(i for i in body["bugs"]["issues"] if "forEach" in i["title"])
    assert issue["line"] == 2 and issue["severity"] == "high"


def test_language_detection_does_not_mistake_es_modules_for_python():
    assert detect_language("import React from 'react';\nexport const A = () => 1;") == "javascript"
    assert detect_language("import os\n\ndef main():\n    pass") == "python"
    assert detect_language("x", "Go") == "Go"


def test_normalizer_helpers():
    assert to_severity("HIGH RISK") == "high" and to_severity("???") == "medium"
    assert to_line("line 12") == 12 and to_line("N/A") is None and to_line(0) is None
    with pytest.raises(ValueError):
        normalize_result("tests", {"framework": "pytest"})
