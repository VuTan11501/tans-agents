export const PROVIDERS = {
  google: {
    label: "Google Gemini",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    // Verified active 2026-05-21 với key free tier (xem scripts/test-models-tools.mjs).
    // gemini-2.5-pro / gemini-2.0-* trả 429 "limit:0" trên free tier → bỏ khỏi list mặc định.
    // gemini-flash-lite-latest có bug "thought_signature" với tool call → bỏ.
    // Gemma 4 hoạt động đầy đủ + có quota free → thêm vào.
    // Để xem hết: bấm "↻ Quét live model" trong dropdown.
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemma-4-26b-a4b-it",
      "gemma-4-31b-it",
    ],
    default: "gemini-2.5-flash",
  },
  groq: {
    label: "Groq (cực nhanh)",
    envKey: "GROQ_API_KEY",
    // Verified active 2026-05-21: tất cả 6 model đều pass tool-call test.
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3-32b",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ],
    default: "llama-3.3-70b-versatile",
  },
  github: {
    label: "GitHub Models",
    envKey: "GITHUB_TOKEN",
    // Verified active 2026-05-21. gpt-4o quota chỉ 50/ngày, dễ burn → đặt mini làm default.
    models: [
      "gpt-4o-mini",
      "gpt-4o",
    ],
    default: "gpt-4o-mini",
  },
  openrouter: {
    label: "OpenRouter (50+ free models)",
    envKey: "OPENROUTER_API_KEY",
    // Free tier: 50 req/ngày/model với suffix `:free`. 1 key mở khóa nhiều model open-source.
    // Curated từ openrouter.ai/models?max_price=0 (top free models 2026-05).
    models: [
      "deepseek/deepseek-chat-v3-0324:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen-2.5-72b-instruct:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
      "nvidia/llama-3.1-nemotron-70b-instruct:free",
      "google/gemma-3-27b-it:free",
    ],
    default: "deepseek/deepseek-chat-v3-0324:free",
  },
  cerebras: {
    label: "Cerebras (>2000 t/s)",
    envKey: "CEREBRAS_API_KEY",
    // Free tier: 30 RPM + 14,400 RPD, inference cực nhanh nhờ wafer-scale chip.
    models: [
      "llama-3.3-70b",
      "llama3.1-8b",
      "qwen-3-32b",
      "gpt-oss-120b",
    ],
    default: "llama-3.3-70b",
  },
  mistral: {
    label: "Mistral La Plateforme",
    envKey: "MISTRAL_API_KEY",
    // Free tier: 1 RPS + 1B tokens/tháng. Codestral chuyên code.
    models: [
      "mistral-small-latest",
      "ministral-8b-latest",
      "ministral-3b-latest",
      "codestral-latest",
    ],
    default: "mistral-small-latest",
  },
  ollama: {
    label: "Ollama (local)",
    envKey: "OLLAMA_BASE_URL",
    models: ["llama3.2", "qwen2.5-coder", "gemma3"],
    default: "llama3.2",
  },
} as const

export type ProviderKey = keyof typeof PROVIDERS
