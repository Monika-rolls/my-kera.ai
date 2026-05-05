from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    deepgram_api_key: str
    cartesia_api_key: str
    openai_api_key: str
    database_url: str = "sqlite+aiosqlite:///./appointments.db"
    port: int = 8000

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
