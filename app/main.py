"""Gradio UI + FastAPI mount. Entry point cho HuggingFace Spaces."""
from __future__ import annotations
import os
from dotenv import load_dotenv
import gradio as gr
from fastapi import FastAPI
from pydantic import BaseModel

load_dotenv()

from app.agent import build_agent
from app.llm import PROVIDERS, available_providers

# ---------- FastAPI ----------
api = FastAPI(title="Tan's Agent API")


class ChatReq(BaseModel):
    message: str
    provider: str = os.getenv("DEFAULT_PROVIDER", "gemini")
    model: str | None = None


@api.get("/health")
def health():
    return {"status": "ok", "providers_ready": available_providers()}


@api.post("/chat")
def chat_api(req: ChatReq):
    agent = build_agent(provider=req.provider, model=req.model)
    out = agent.invoke({"input": req.message})
    return {"response": out.get("output", "")}


# ---------- Gradio UI ----------
def respond(message, history, provider, model):
    if not message:
        return "Vui lòng nhập câu hỏi."
    try:
        agent = build_agent(provider=provider, model=model or None)
        # Chuyển history (list of [user, assistant]) -> messages
        chat_history = []
        for turn in history or []:
            if isinstance(turn, (list, tuple)) and len(turn) == 2:
                u, a = turn
                if u:
                    chat_history.append(("human", u))
                if a:
                    chat_history.append(("ai", a))
        result = agent.invoke({"input": message, "chat_history": chat_history})
        return result.get("output", "(không có phản hồi)")
    except Exception as e:
        return f"⚠️ Lỗi: {e}"


def update_models(provider):
    models = PROVIDERS.get(provider, {}).get("models", [])
    default = PROVIDERS.get(provider, {}).get("default", models[0] if models else "")
    return gr.update(choices=models, value=default)


with gr.Blocks(title="Tan's AI Agent", theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        "# 🤖 Tan's AI Agent\n"
        "Multi-provider ReAct agent với web search, calculator, time tool. "
        "Tất cả model đều **miễn phí**."
    )
    ready = available_providers()
    if not ready:
        gr.Markdown(
            "### ⚠️ Chưa có API key\n"
            "Vào tab **Settings → Variables and secrets** của HF Space và thêm 1 trong: "
            "`GOOGLE_API_KEY`, `GROQ_API_KEY`, `GITHUB_TOKEN`."
        )

    with gr.Row():
        provider_dd = gr.Dropdown(
            choices=list(PROVIDERS.keys()),
            value=ready[0] if ready else "gemini",
            label="Provider",
            scale=1,
        )
        model_dd = gr.Dropdown(
            choices=PROVIDERS[ready[0] if ready else "gemini"]["models"],
            value=PROVIDERS[ready[0] if ready else "gemini"]["default"],
            label="Model",
            scale=2,
        )

    provider_dd.change(update_models, inputs=provider_dd, outputs=model_dd)

    chat = gr.ChatInterface(
        fn=respond,
        additional_inputs=[provider_dd, model_dd],
        examples=[
            ["Bây giờ là mấy giờ?"],
            ["Tin tức mới nhất về AI hôm nay?"],
            ["Tính giúp tôi (1234 * 5678) + 999"],
            ["Giải thích Transformer trong 3 câu"],
        ],
    )

# Mount Gradio vào FastAPI tại "/"
app = gr.mount_gradio_app(api, demo, path="/")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "7860"))
    uvicorn.run(app, host="0.0.0.0", port=port)
