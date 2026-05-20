"""Core ReAct agent dùng LangGraph-style executor."""
from __future__ import annotations
from typing import Optional
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from app.llm import build_llm
from app.tools import get_tools

SYSTEM_PROMPT = (
    "Bạn là Tan's Agent - một AI assistant hữu ích, trả lời ngắn gọn bằng tiếng Việt "
    "(trừ khi user dùng ngôn ngữ khác). Khi cần thông tin thực tế hãy dùng tool web_search. "
    "Khi cần tính toán hãy dùng tool calculator. Khi hỏi giờ hãy dùng current_time."
)


def build_agent(provider: str = "gemini", model: Optional[str] = None) -> AgentExecutor:
    llm = build_llm(provider=provider, model=model)
    tools = get_tools()
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder("chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ])
    agent = create_tool_calling_agent(llm, tools, prompt)
    return AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=False,
        handle_parsing_errors=True,
        max_iterations=6,
    )
