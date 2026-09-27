"""
Thin wrapper around IBM watsonx.ai for CodeGuardian AI.

If WATSONX_API_KEY / WATSONX_PROJECT_ID are not configured, `is_configured()`
returns False and the caller (analyzer.py) falls back to mock responses so
the rest of the application remains fully demoable without live credentials.
"""
import re
import json
import logging
from typing import Optional

from config import settings

logger = logging.getLogger("codeguardian.watsonx")

_model = None


def is_configured() -> bool:
    return settings.is_watsonx_configured


def _get_model():
    """Lazily construct the watsonx ModelInference client."""
    global _model
    if _model is not None:
        return _model

    from ibm_watsonx_ai import Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference

    credentials = Credentials(url=settings.WATSONX_URL, api_key=settings.WATSONX_API_KEY)
    _model = ModelInference(
        model_id=settings.WATSONX_MODEL_ID,
        credentials=credentials,
        project_id=settings.WATSONX_PROJECT_ID,
        params={
            "decoding_method": "greedy",
            "max_new_tokens": 1200,
            "repetition_penalty": 1.05,
        },
    )
    return _model


def extract_json(raw_text: str) -> Optional[dict]:
    """Extract valid JSON from LLM output, handling markdown code fences and extraneous text."""
    if not raw_text or not raw_text.strip():
        return None

    text = raw_text.strip()

    # 1. Try markdown fence match ```json ... ``` or ``` ... ```
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence_match:
        candidate = fence_match.group(1).strip()
        try:
            return json.loads(candidate)
        except Exception:
            pass

    # 2. Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # 3. Try finding substring between outermost braces { ... }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace : last_brace + 1].strip()
        try:
            return json.loads(candidate)
        except Exception:
            pass

    return None


def generate_json(prompt: str) -> Optional[dict]:
    """
    Send a prompt to the Granite model and parse the response as JSON.
    Returns None on failure so the caller can fall back to a mock response.
    """
    if not is_configured():
        return None

    try:
        model = _get_model()
        raw_text = model.generate_text(prompt=prompt)
        parsed = extract_json(raw_text)
        if parsed is not None:
            return parsed
        logger.warning("Failed to extract valid JSON from watsonx output. Raw preview: %s", raw_text[:200])
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("watsonx.ai generation failed, falling back to mock: %s", exc)
        return None
