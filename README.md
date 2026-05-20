---
title: Tan's AI Agent
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Multi-provider free AI agent (Gemini/Groq/GitHub Models)
---

# 🤖 Tan's AI Agent

Multi-provider ReAct agent **100% miễn phí** với:

- 🧠 **Multi LLM**: Google Gemini, Groq (Llama 3.x), GitHub Models (GPT-4o, Phi-3, Mistral)
- 🛠️ **Tools**: Web search (DuckDuckGo), Calculator, Current time
- 💬 **Gradio UI** + **FastAPI** REST endpoint
- 🚀 Deploy 1-click lên HuggingFace Spaces (free vĩnh viễn)

## 🚀 Quick start (local)

```bash
git clone https://github.com/<your-user>/tans-agents.git
cd tans-agents
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env             # rồi điền ít nhất 1 API key
python -m app.main
# Mở http://localhost:7860
```

## 🔑 Lấy API key (free)

| Provider | Link | Free tier |
|---|---|---|
| **Gemini** | https://aistudio.google.com/app/apikey | 60 req/phút |
| **Groq** | https://console.groq.com/keys | 30 req/phút, cực nhanh |
| **GitHub Models** | https://github.com/settings/tokens | Dùng PAT (read:user) |

Chỉ cần **1 trong 3** là chạy được. Có cả 3 thì có thể switch trên UI.

## 📡 API endpoints

```bash
# Health check
curl http://localhost:7860/health

# Chat
curl -X POST http://localhost:7860/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Giờ Tokyo bây giờ?","provider":"gemini"}'
```

## ☁️ Deploy lên HuggingFace Spaces (free vĩnh viễn)

1. Tạo Space mới tại https://huggingface.co/new-space → SDK = **Docker**
2. Trong Space **Settings → Variables and secrets**, thêm:
   - `GOOGLE_API_KEY` (hoặc `GROQ_API_KEY` / `GITHUB_TOKEN`)
3. Push code:
   ```bash
   git remote add hf https://huggingface.co/spaces/<user>/tans-agents
   git push hf main
   ```
4. HF sẽ tự build Dockerfile và serve tại `https://<user>-tans-agents.hf.space`.

Hoặc dùng **GitHub Actions** trong `.github/workflows/sync-to-hf.yml` để auto-sync mỗi khi push lên GitHub (cần thêm `HF_TOKEN` secret).

## 🏗️ Cấu trúc

```
tans-agents/
├── app/
│   ├── llm.py      # Multi-provider factory
│   ├── tools.py    # Web search, calc, time
│   ├── agent.py    # ReAct agent
│   └── main.py     # Gradio UI + FastAPI
├── Dockerfile
├── requirements.txt
└── .github/workflows/sync-to-hf.yml
```

## 📜 License

MIT
