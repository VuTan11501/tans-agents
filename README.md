# 🤖 Tan's AI Agent

Multi-provider **free** AI agent with beautiful **shadcn/ui** chat interface.

![Built with Next.js, shadcn/ui, Vercel AI SDK](https://img.shields.io/badge/Next.js-15-black) ![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Latest-zinc) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

- 🎨 **Modern UI** — shadcn/ui (New York style, dark mode) with Tailwind CSS
- 🧠 **3 free LLM providers** — switch any time from dropdown:
  - **Google Gemini** (2.5 Flash/Pro, 2.0 Flash) — 60 req/min free
  - **Groq** (Llama 3.3 70B, Mixtral, Gemma2) — cực nhanh, 30 req/min free
  - **GitHub Models** (GPT-4o, Phi-3.5, Mistral-Nemo) — free với GH PAT
- 🛠️ **Agent tools** — Web search (DuckDuckGo), Calculator, Current time
- 💬 **Streaming responses** with tool-call badges
- 🌙 Dark mode, Markdown rendering, mobile-friendly
- 🚀 **One-click deploy to Vercel** (100% free tier)

## 🚀 Deploy to Vercel (5 phút, $0)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/VuTan11501/tans-agents&env=GOOGLE_GENERATIVE_AI_API_KEY&envDescription=Get%20a%20free%20Gemini%20key%20at%20aistudio.google.com)

1. Click button trên ↑
2. Login Vercel với GitHub (free)
3. Add env var `GOOGLE_GENERATIVE_AI_API_KEY` (lấy free tại https://aistudio.google.com/app/apikey)
4. Click **Deploy** → 2 phút sau có URL live `https://tans-agents.vercel.app`

## 💻 Run locally

```bash
git clone https://github.com/VuTan11501/tans-agents.git
cd tans-agents
npm install
cp .env.local.example .env.local       # rồi điền ít nhất 1 API key
npm run dev
# Mở http://localhost:3000
```

## 🔑 API keys (chọn 1, tất cả miễn phí)

| Provider | Get key | Env var |
|---|---|---|
| **Gemini** (khuyến nghị) | https://aistudio.google.com/app/apikey | `GOOGLE_GENERATIVE_AI_API_KEY` |
| **Groq** | https://console.groq.com/keys | `GROQ_API_KEY` |
| **GitHub Models** | https://github.com/settings/tokens | `GITHUB_TOKEN` |

## ☁️ Cloud Sync (optional, free)

Đồng bộ chat history + settings cross-device qua GitHub OAuth + Upstash Redis. **Hoàn toàn miễn phí**:

1. **Tạo GitHub OAuth App** tại https://github.com/settings/developers → New OAuth App
   - Homepage URL: `https://your-deploy.example.com`
   - Authorization callback URL: `https://your-deploy.example.com/api/auth/callback/github`
   - Sau khi tạo → copy `Client ID` + Generate `Client Secret`
2. **Đăng ký Upstash** tại https://console.upstash.com → Create Redis Database (free 10K cmds/day, 256MB)
   - Copy `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
3. **Set env vars** (Vercel/HF Space secrets):
   ```
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   NEXTAUTH_SECRET=...        # openssl rand -base64 32
   NEXTAUTH_URL=https://your-deploy.example.com
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   ```
4. **Bấm "Đăng nhập để sync"** ở sidebar → đăng nhập GitHub → từ giờ mọi mutation sẽ tự push, focus tab sẽ pull (LWW conflict resolution).

Scope đồng bộ: chat history, model preferences, theme/density, prompts, snippets, memory, voice settings, RAG active collection. **KHÔNG sync**: API keys (per-device), RAG document content (giữ trong IndexedDB local).

## 🏗️ Architecture

```
tans-agents/
├── app/
│   ├── api/chat/route.ts   # Edge API route, streams via Vercel AI SDK
│   ├── layout.tsx, page.tsx, globals.css
├── components/
│   ├── chat.tsx            # Main chat UI with provider/model switcher
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── providers.ts        # Multi-LLM config
│   ├── tools.ts            # webSearch, calculator, currentTime
│   └── utils.ts            # cn() helper
├── python/                 # OPTIONAL Python/FastAPI backend (Gradio UI)
│   ├── app/agent.py, tools.py, llm.py, main.py
│   ├── Dockerfile          # for HuggingFace Spaces deploy
│   └── requirements.txt
├── package.json, tailwind.config.ts, components.json
└── .github/workflows/ci.yml
```

## 🎨 Design system

Built with **shadcn/ui** (New York style, zinc base color):
- `Button`, `Card`, `Input`, `Select`, `ScrollArea`, `Avatar`, `Badge`, `Separator`
- Radix UI primitives, fully accessible
- Tailwind CSS với CSS variables cho dark/light theme
- Lucide icons

## 🐍 Alternative: Python/FastAPI version

Trong `python/` folder có FastAPI + Gradio version, đã được deploy lên HuggingFace Spaces:

🔗 **Live demo**: https://tan115-tans-agents.hf.space
🔗 **HF Space**: https://huggingface.co/spaces/Tan115/tans-agents

```bash
cd python
pip install -r requirements.txt
python -m app.main
```

## 📜 License

MIT
