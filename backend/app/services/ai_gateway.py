import logging
from typing import Literal, Optional
from langchain_groq import ChatGroq
from langchain_core.language_models.chat_models import BaseChatModel
from app.core.config import Settings, settings

logger = logging.getLogger(__name__)

LanePriority = Literal["FAST", "MEDIUM", "SLOW", "VISION"]

def get_current_llm(model_name: Optional[str] = None, temperature: float = 0.2) -> BaseChatModel | None:
    try:
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is not set.")
        
        chosen_model = model_name or settings.DEFAULT_GROQ_MODEL
        return ChatGroq(
            model_name=chosen_model,  
            groq_api_key=settings.GROQ_API_KEY, 
            temperature=temperature
        )
    except Exception as e:
        logger.error(f"Error initializing LLM: {e}")
        return None

def get_llm(lane: LanePriority = "FAST", temperature: float = 0.2):
    if lane == "VISION":
        target = settings.VISION_LLM_MODEL
    elif lane == "SLOW":
        target = settings.SLOWLANE
    else:
        target = settings.FASTLANE
    return get_current_llm(model_name=target, temperature=temperature)