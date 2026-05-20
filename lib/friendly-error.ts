// Map raw API/runtime errors to friendly Vietnamese messages.
// Returns { title, hint, raw } — UI shows title + hint, raw collapsed in <details>.

export interface FriendlyError {
  title: string
  hint?: string
  raw: string
}

const PATTERNS: Array<{ match: RegExp; title: string; hint?: string }> = [
  {
    match: /string did not match the expected pattern/i,
    title: "Phản hồi không hợp lệ",
    hint: "Model có thể trả về JSON/URL sai định dạng, hoặc API key chứa ký tự lạ. Thử model khác hoặc kiểm tra lại API key trong Cài đặt.",
  },
  {
    match: /quota|rate.?limit|429|exceeded/i,
    title: "Đã vượt quota / rate limit",
    hint: "Model này hết hạn ngạch tạm thời. Đợi vài phút hoặc đổi sang model khác (Groq / GitHub Models có quota riêng).",
  },
  {
    match: /401|unauthor|invalid.?api.?key|api key not valid/i,
    title: "API key không hợp lệ",
    hint: "Kiểm tra lại key tại Cài đặt → API Keys. Đảm bảo key đúng provider và còn hiệu lực.",
  },
  {
    match: /403|forbidden|permission/i,
    title: "Không có quyền truy cập",
    hint: "Model có thể yêu cầu trả phí, vùng địa lý không hỗ trợ, hoặc API key thiếu scope.",
  },
  {
    match: /404|not found.*model|model.*not.*found|is not supported/i,
    title: "Model không khả dụng",
    hint: "Model này không tồn tại hoặc chưa hỗ trợ generateContent. Thử model khác trong danh sách.",
  },
  {
    match: /timeout|timed out|aborted/i,
    title: "Hết thời gian chờ",
    hint: "Server phản hồi quá chậm. Thử lại — nếu lặp lại liên tục, đổi model.",
  },
  {
    match: /failed to fetch|network|ECONNREFUSED|ENOTFOUND|fetch failed/i,
    title: "Lỗi kết nối mạng",
    hint: "Không truy cập được API. Kiểm tra Internet, VPN, hoặc proxy.",
  },
  {
    match: /500|internal server/i,
    title: "Lỗi server",
    hint: "Server provider đang gặp sự cố. Thử lại sau vài giây.",
  },
  {
    match: /context.*length|too many tokens|input.*too long|maximum context/i,
    title: "Vượt quá giới hạn context",
    hint: "Hội thoại quá dài. Bật 'Tự nén context' trong composer hoặc bắt đầu chat mới.",
  },
  {
    match: /content_filter|safety|blocked/i,
    title: "Bị chặn bởi safety filter",
    hint: "Nội dung bị model từ chối. Thử diễn đạt lại câu hỏi.",
  },
  {
    match: /tool.*invalid|invalid.*tool|function call|schema/i,
    title: "Lỗi tool call",
    hint: "Model trả về định dạng tool call không hợp lệ. Thử lại hoặc đổi model có hỗ trợ function calling tốt hơn (Gemini 2.5 Flash, Llama 3.x).",
  },
]

export function friendlyError(err: unknown): FriendlyError {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err)
  for (const p of PATTERNS) {
    if (p.match.test(raw)) {
      return { title: p.title, hint: p.hint, raw }
    }
  }
  return { title: "Có lỗi khi gọi AI", raw }
}
