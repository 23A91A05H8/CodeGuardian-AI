from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "watsonx_configured" in data
    assert "mode" in data

def test_analyze_code_explain():
    payload = {
        "code": "def calculate_total(items):\n    return sum(item['price'] for item in items)",
        "language": "python",
        "filename": "totals.py"
    }
    response = client.post("/analyze/code", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_type"] == "explain"
    assert data["explanation"] is not None
    assert "purpose" in data["explanation"]
    assert "quality_score" in data

def test_analyze_bugs():
    payload = {
        "code": "def process():\n    try:\n        pass\n    except:\n        pass",
        "language": "python"
    }
    response = client.post("/analyze/bugs", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_type"] == "bugs"
    assert len(data["bugs"]["issues"]) > 0

def test_analyze_security_sql_injection():
    payload = {
        "code": "query = 'SELECT * FROM users WHERE name = ' + user_input\ncursor.execute(query)",
        "language": "python"
    }
    response = client.post("/analyze/security", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_type"] == "security"
    assert data["security"]["overall_risk"] in ("high", "critical")
    assert any("SQL Injection" in i["title"] for i in data["security"]["issues"])

def test_analyze_refactor():
    payload = {
        "code": "def add(a, b): return a + b",
        "language": "python"
    }
    response = client.post("/analyze/refactor", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_type"] == "refactor"
    assert len(data["refactor"]["suggestions"]) > 0

def test_generate_tests():
    payload = {
        "code": "def multiply(x, y): return x * y",
        "language": "python"
    }
    response = client.post("/generate/tests", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_type"] == "tests"
    assert "test_code" in data["tests"]

def test_generate_docs():
    payload = {
        "code": "def greet(name: str) -> str: return f'Hello, {name}'",
        "language": "python"
    }
    response = client.post("/generate/docs", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_type"] == "docs"
    assert "documentation" in data["docs"]

def test_empty_code_rejected():
    response = client.post("/analyze/code", json={"code": "   "})
    assert response.status_code == 400
