from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # LiveKit — required
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str

    # LLM provider selection
    llm_provider: str = "openai"        # "openai" or "gemini"
    llm_model: str = ""                 # auto-defaults per provider when blank
    openai_api_key: str = ""
    gemini_api_key: str = ""

    # Agent-only (not needed by the REST API / Vercel)
    deepgram_api_key: str = ""
    cartesia_api_key: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./appointments.db"
    port: int = 8000

    # Google Sheets (optional — see app/sheets.py for setup instructions)
    google_sheet_id: str = ""
    google_service_account_json: str = ""  # full service-account JSON as a single-line string

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"                # silently ignore any unknown env vars


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
