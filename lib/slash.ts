export interface SlashCommand {
  id: string
  trigger: string
  label: string
  description: string
  template: (rest: string) => string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "code",
    trigger: "/code",
    label: "Code",
    description: "Yêu cầu viết / giải thích code",
    template: (rest) => `Viết code (kèm giải thích ngắn): ${rest}`,
  },
  {
    id: "explain",
    trigger: "/explain",
    label: "Giải thích",
    description: "Giải thích chi tiết một khái niệm",
    template: (rest) => `Giải thích chi tiết, dễ hiểu: ${rest}`,
  },
  {
    id: "translate",
    trigger: "/translate",
    label: "Dịch",
    description: "Dịch giữa Việt ↔ Anh",
    template: (rest) => `Dịch (auto detect VI ↔ EN), giữ format: ${rest}`,
  },
  {
    id: "summarize",
    trigger: "/summarize",
    label: "Tóm tắt",
    description: "Tóm tắt văn bản hoặc URL",
    template: (rest) => `Tóm tắt ngắn gọn (3-5 bullet): ${rest}`,
  },
  {
    id: "image",
    trigger: "/image",
    label: "Tạo ảnh",
    description: "Sinh ảnh AI (dùng tool generateImage)",
    template: (rest) => `Hãy dùng tool generateImage để tạo ảnh: ${rest}`,
  },
  {
    id: "search",
    trigger: "/search",
    label: "Tìm kiếm web",
    description: "Tìm thông tin trên web (dùng tool webSearch)",
    template: (rest) => `Hãy dùng tool webSearch rồi tổng hợp: ${rest}`,
  },
]

export function matchSlash(input: string): { matches: SlashCommand[]; query: string } | null {
  if (!input.startsWith("/")) return null
  const space = input.indexOf(" ")
  const query = space === -1 ? input.slice(1) : input.slice(1, space)
  if (space !== -1) return null
  const q = query.toLowerCase()
  const matches = SLASH_COMMANDS.filter(
    (c) => c.id.startsWith(q) || c.trigger.toLowerCase().includes(q)
  )
  return { matches, query }
}
