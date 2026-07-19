import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

class Settings:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    FASTLANE = "llama-3.1-8b-instant"
    SLOWLANE = "llama-3.3-70b-versatile"
    VOICE_LLM = "whisper-large-v3"
    VISION_LLM_MODEL = "llama-3.2-90b-vision-preview"
    DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"

    DATABASE_URL = os.getenv("DATABASE_URL")
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

settings = Settings()
