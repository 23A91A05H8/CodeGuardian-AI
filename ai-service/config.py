import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0").strip()
    PORT: int = int(os.getenv("PORT", "8000").strip())
    WATSONX_API_KEY: str = os.getenv("WATSONX_API_KEY", "").strip()
    WATSONX_PROJECT_ID: str = os.getenv("WATSONX_PROJECT_ID", "").strip()
    WATSONX_URL: str = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com").strip()
    WATSONX_MODEL_ID: str = os.getenv("WATSONX_MODEL_ID", "ibm/granite-13b-instruct-v2").strip()
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
