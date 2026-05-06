from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    openai_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./appointments.db"
    port: int = 8000
    # LLM provider selection: "openai" or "gemini"
    llm_provider: str = "openai"
    llm_model: str = ""          # auto-defaults per provider when blank
    gemini_api_key: str = ""
    # Agent-only — not required by the REST API
    deepgram_api_key: str = ""
    cartesia_api_key: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
