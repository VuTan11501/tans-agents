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
} as const

export type ProviderKey = keyof typeof PROVIDERS
