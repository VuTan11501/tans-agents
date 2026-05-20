"""Multi-provider LLM factory. Người dùng chọn provider + model tuỳ thích."""
from __future__ import annotations
import os
from typing import Optional

# Danh sách model free khả dụng cho mỗi provider
PROVIDERS = {
    "gemini": {
        "label": "Google Gemini",
        "env": "GOOGLE_API_KEY",
        "models": [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-flash-latest",
            "gemini-pro-latest",
        ],
        "default": "gemini-2.5-flash-lite",
    },
    "groq": {
        "label": "Groq (cực nhanh)",
        "env": "GROQ_API_KEY",
        "models": [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "llama-3.2-90b-vision-preview",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
        ],
        "default": "llama-3.3-70b-versatile",
    },
    "github": {
        "label": "GitHub Models",
        "env": "GITHUB_TOKEN",
        "models": [
            "gpt-4o-mini",
            "gpt-4o",
            "Phi-3.5-mini-instruct",
            "Mistral-Nemo",
            "Llama-3.3-70B-Instruct",
        ],
        "default": "gpt-4o-mini",
    },
}


def available_providers() -> list[str]:
    """Trả về list provider có API key sẵn sàng dùng."""
    return [p for p, cfg in PROVIDERS.items() if os.getenv(cfg["env"])]


def build_llm(provider: str, model: Optional[str] = None, temperature: float = 0.3):
    """Khởi tạo LLM theo provider chọn. Raise nếu thiếu key."""
    if provider not in PROVIDERS:
        raise ValueError(f"Provider không hỗ trợ: {provider}. Chọn 1 trong {list(PROVIDERS)}")

    cfg = PROVIDERS[provider]
    api_key = os.getenv(cfg["env"])
    if not api_key:
        raise RuntimeError(
            f"Thiếu biến môi trường {cfg['env']} cho provider {provider}. "
            f"Xem .env.example để lấy hướng dẫn API key."
        )

    model = model or cfg["default"]

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model, google_api_key=api_key, temperature=temperature)

    if provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(model=model, groq_api_key=api_key, temperature=temperature)

    if provider == "github":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url="https://models.inference.ai.azure.com",
            temperature=temperature,
        )

    raise ValueError(f"Provider {provider} chưa implement")
