import logging
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("codeguardian.config")

DEFAULT_MODEL_ID = "ibm/granite-4-h-small"
# Models IBM has withdrawn from watsonx.ai; an old .env may still point at them.
WITHDRAWN_MODEL_IDS = {
    "ibm/granite-13b-instruct-v2",
    "ibm/granite-13b-chat-v2",
    "ibm/granite-13b-instruct-v1",
    "ibm/granite-13b-chat-v1",
}


def _resolve_model_id(value: str) -> str:
    value = (value or "").strip() or DEFAULT_MODEL_ID
    if value in WITHDRAWN_MODEL_IDS:
        logger.warning(
            "WATSONX_MODEL_ID=%s has been withdrawn from watsonx.ai; using %s instead. "
            "Update your .env to silence this warning.", value, DEFAULT_MODEL_ID,
        )
        return DEFAULT_MODEL_ID
    return value

class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0").strip()
    PORT: int = int(os.getenv("PORT", "8000").strip())
    WATSONX_API_KEY: str = os.getenv("WATSONX_API_KEY", "").strip()
    WATSONX_PROJECT_ID: str = os.getenv("WATSONX_PROJECT_ID", "").strip()
    WATSONX_URL: str = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com").strip()
    WATSONX_MODEL_ID: str = _resolve_model_id(os.getenv("WATSONX_MODEL_ID", DEFAULT_MODEL_ID))
    WATSONX_MAX_TOKENS: int = int(os.getenv("WATSONX_MAX_TOKENS", "4096").strip())
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*").strip()
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60").strip())

    @property
    def is_watsonx_configured(self) -> bool:
        return bool(self.WATSONX_API_KEY and self.WATSONX_PROJECT_ID)

    @property
    def origins_list(self) -> list[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

settings = Settings()
