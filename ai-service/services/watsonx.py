"""
Thin wrapper around IBM watsonx.ai for CodeGuardian AI.

* Uses the **chat** endpoint (what current Granite models such as
  ``ibm/granite-4-h-small`` expect), asking for a JSON object, and falls back
  to plain text generation if the installed SDK / model lacks chat support.
* If WATSONX_API_KEY / WATSONX_PROJECT_ID are not configured, ``is_configured()``
  returns False and the analyzer uses its heuristic fallback so the app stays
  fully usable without credentials.
* Failures never raise to the caller: ``generate_json`` returns
  ``(parsed_or_None, reason_or_None)`` so the UI can show *why* a fallback
  was used (bad API key, withdrawn model, unparsable output, ...).
"""
import ast
import json
import logging
import re
from typing import Any, Optional, Tuple

from config import settings

logger = logging.getLogger("codeguardian.watsonx")

SYSTEM_PROMPT = (
    "You are CodeGuardian AI, an expert code analysis engine. "
    "Reply with a single valid JSON object only: no markdown fences, no commentary. "
    "Escape newlines inside JSON strings as \\n."
)

_model = None


def is_configured() -> bool:
    return settings.is_watsonx_configured


def _get_model():
    """Lazily construct the watsonx ModelInference client (not cached on failure)."""
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
    )
    return _model


def extract_json(raw_text: str) -> Optional[Any]:
    """Extract JSON from LLM output, tolerating fences, prose, raw newlines and trailing commas."""
    if not raw_text or not raw_text.strip():
        return None

    text = raw_text.strip()
    candidates = []

    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence:
        candidates.append(fence.group(1).strip())
    candidates.append(text)

    first_obj, last_obj = text.find("{"), text.rfind("}")
    if first_obj != -1 and last_obj > first_obj:
        candidates.append(text[first_obj:last_obj + 1])
    first_arr, last_arr = text.find("["), text.rfind("]")
    if first_arr != -1 and last_arr > first_arr:
        candidates.append(text[first_arr:last_arr + 1])

    for candidate in candidates:
        for variant in (candidate, re.sub(r",\s*([}\]])", r"\1", candidate)):
            try:
                # strict=False tolerates raw newlines/tabs inside strings (typical for code-in-JSON)
                return json.loads(variant, strict=False)
            except Exception:  # noqa: BLE001
                pass

    # Last resort: Python-literal style output (single quotes, None/True/False)
    for candidate in candidates[1:]:
        try:
            value = ast.literal_eval(candidate)
            if isinstance(value, (dict, list)):
                return value
        except Exception:  # noqa: BLE001
            pass
    return None


def _call_model(prompt: str) -> str:
    model = _get_model()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    if hasattr(model, "chat"):
        base_params = {"temperature": 0, "max_tokens": settings.WATSONX_MAX_TOKENS}
        try:
            response = model.chat(messages=messages, params={**base_params, "response_format": {"type": "json_object"}})
        except Exception as exc:  # noqa: BLE001
            # Some models/deployments reject response_format; retry without it.
            logger.info("chat with response_format failed (%s); retrying without it", exc)
            response = model.chat(messages=messages, params=base_params)
        content = response["choices"][0]["message"].get("content")
        if isinstance(content, list):  # content-parts format
            content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
        return content or ""

    return model.generate_text(
        prompt=f"{SYSTEM_PROMPT}\n\n{prompt}",
        params={"decoding_method": "greedy", "max_new_tokens": settings.WATSONX_MAX_TOKENS},
    )


def generate_json(prompt: str) -> Tuple[Optional[Any], Optional[str]]:
    """
    Returns (parsed_json, None) on success or (None, human_readable_reason) on failure.
    """
    if not is_configured():
        return None, "watsonx.ai credentials are not configured (demo mode)."

    try:
        raw_text = _call_model(prompt)
    except Exception as exc:  # noqa: BLE001
        reason = f"watsonx.ai request failed ({settings.WATSONX_MODEL_ID}): {str(exc)[:300]}"
        logger.warning(reason)
        return None, reason

    parsed = extract_json(raw_text)
    if parsed is None:
        reason = "watsonx.ai returned a response that was not valid JSON (it may have been truncated)."
        logger.warning("%s Raw preview: %s", reason, (raw_text or "")[:200])
        return None, reason
    return parsed, None
