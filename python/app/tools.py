"""Custom tools cho agent. Tất cả đều free, không cần API key trả phí."""
from __future__ import annotations
from datetime import datetime
from langchain_core.tools import tool


@tool
def current_time(_: str = "") -> str:
    """Trả về thời gian hiện tại theo ISO format. Dùng khi user hỏi giờ/ngày."""
    return datetime.now().isoformat(timespec="seconds")


@tool
def web_search(query: str) -> str:
    """Tìm kiếm web qua DuckDuckGo (free, không cần API key).
    Dùng khi cần thông tin thực tế, tin tức, hoặc data ngoài training cutoff."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        if not results:
            return "Không tìm thấy kết quả."
        return "\n\n".join(
            f"[{i+1}] {r.get('title','')}\n{r.get('body','')}\n{r.get('href','')}"
            for i, r in enumerate(results)
        )
    except Exception as e:
        return f"Lỗi khi tìm kiếm: {e}"


@tool
def calculator(expression: str) -> str:
    """Tính biểu thức toán học đơn giản. Ví dụ: '2 + 2 * 3'."""
    try:
        allowed = set("0123456789+-*/.() ")
        if not set(expression) <= allowed:
            return "Lỗi: chỉ cho phép số và toán tử +-*/()."
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as e:
        return f"Lỗi: {e}"


def get_tools():
    return [current_time, web_search, calculator]
