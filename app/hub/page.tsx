"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, Search, Sparkles } from "lucide-react"

type FeatureItem = {
  href: string
  title: string
  description: string
  icon: string
}

type FeatureCategory = {
  id: string
  label: string
  key: string
  items: FeatureItem[]
}

const CATEGORIES: FeatureCategory[] = [
  {
    id: "chat-ai",
    label: "Chat & AI",
    key: "chat, AI",
    items: [
      { href: "/", title: "Trang chính", description: "Chat AI đa provider cho công việc hằng ngày.", icon: "💬" },
      { href: "/debate", title: "Tranh luận AI", description: "Cho nhiều AI phản biện và so sánh lập luận.", icon: "⚔️" },
      { href: "/voice", title: "Giọng nói TTS", description: "Chuyển văn bản thành giọng nói nhanh.", icon: "🔊" },
      { href: "/scheduled", title: "Chat hẹn giờ", description: "Lên lịch gửi prompt hoặc tác vụ chat.", icon: "⏰" },
      { href: "/workflows", title: "Workflow builder", description: "Ghép các bước AI thành quy trình tự động.", icon: "🧩" },
      { href: "/clip", title: "AI Clipboard", description: "Xử lý nội dung clipboard bằng AI.", icon: "📋" },
      { href: "/translate", title: "Dịch thuật", description: "Dịch nội dung giữa nhiều ngôn ngữ bằng AI.", icon: "🌐" },
      { href: "/tone", title: "Phân tích tông giọng", description: "Nhận diện sắc thái, cảm xúc và độ phù hợp của văn bản.", icon: "🎚️" },
      { href: "/url-summary", title: "Tóm tắt URL", description: "Đọc và tóm tắt nhanh nội dung từ liên kết.", icon: "🔗" },
      { href: "/writing", title: "Trợ lý viết", description: "Lên ý tưởng, chỉnh sửa và hoàn thiện nội dung viết.", icon: "✍️" },
      { href: "/flashcards", title: "Flashcards AI", description: "Tạo thẻ ghi nhớ từ nội dung học tập hoặc ghi chú.", icon: "🃏" },
      { href: "/mindmap-ai", title: "Mindmap AI", description: "Biến ý tưởng thành sơ đồ tư duy có cấu trúc.", icon: "🧠" },
      { href: "/resume", title: "CV/Resume", description: "Phân tích ATS, khớp JD và tối ưu CV bằng AI.", icon: "📄" },
      { href: "/personas-mp", title: "Persona Marketplace", description: "Chọn và quản lý persona cho từng ngữ cảnh.", icon: "🎭" },
      { href: "/templates", title: "Prompt templates", description: "Thư viện mẫu prompt có biến điền nhanh.", icon: "✨" },
      { href: "/email", title: "Viết email", description: "Soạn email chuyên nghiệp, rõ ý và đúng tông giọng.", icon: "✉️" },
    ],
  },
  {
    id: "history",
    label: "Lịch sử & quản lý",
    key: "history",
    items: [
      { href: "/search", title: "Tìm kiếm hội thoại", description: "Tìm lại nội dung trong lịch sử chat.", icon: "🔎" },
      { href: "/pinned", title: "Đã ghim", description: "Truy cập nhanh các hội thoại quan trọng.", icon: "📌" },
      { href: "/favorites", title: "Yêu thích", description: "Danh sách câu trả lời và đoạn chat đã lưu.", icon: "⭐" },
      { href: "/tags", title: "Lọc theo nhãn", description: "Quản lý hội thoại bằng tag và bộ lọc.", icon: "🏷️" },
      { href: "/notes", title: "Ghi chú", description: "Ghi chú nhanh liên kết với ý tưởng chat.", icon: "📝" },
      { href: "/export", title: "Xuất Markdown", description: "Xuất hội thoại ra Markdown để lưu trữ.", icon: "📤" },
      { href: "/mind-map", title: "Sơ đồ phân nhánh", description: "Xem ý tưởng và hội thoại dưới dạng mind map.", icon: "🧠" },
    ],
  },
  {
    id: "collab",
    label: "Cộng tác",
    key: "collab",
    items: [
      { href: "/team", title: "Team workspace", description: "Không gian làm việc nhóm cho prompt và chat.", icon: "👥" },
      { href: "/meeting", title: "Phòng họp đa người", description: "Tạo và tham gia phòng họp với AI hỗ trợ.", icon: "🎙️" },
      { href: "/meeting/demo", title: "Phòng họp theo ID", description: "Mở nhanh route phòng họp động /meeting/[roomId].", icon: "🚪" },
      { href: "/share/demo", title: "Chia sẻ", description: "Xem bản chia sẻ từ Sidebar của từng session.", icon: "🔗" },
      { href: "/meeting-notes", title: "Ghi chú họp", description: "Tóm tắt nội dung họp, quyết định và việc cần làm.", icon: "📝" },
      { href: "/interview", title: "Phỏng vấn mock", description: "Luyện phỏng vấn với câu hỏi, phản hồi và gợi ý cải thiện.", icon: "🎤" },
    ],
  },
  {
    id: "life-productivity",
    label: "Cuộc sống & Năng suất",
    key: "life productivity soft skills",
    items: [
      { href: "/recipe", title: "Nấu ăn", description: "Gợi ý món ăn, nguyên liệu và các bước nấu phù hợp.", icon: "🍳" },
      { href: "/travel", title: "Lên kế hoạch du lịch", description: "Lập lịch trình, ngân sách và checklist cho chuyến đi.", icon: "✈️" },
      { href: "/study", title: "Lộ trình học", description: "Xây dựng kế hoạch học tập theo mục tiêu và thời gian.", icon: "📚" },
      { href: "/music", title: "Gợi ý nhạc", description: "Tìm playlist và bài hát theo tâm trạng hoặc hoạt động.", icon: "🎵" },
      { href: "/names", title: "Tạo tên", description: "Gợi ý tên thương hiệu, dự án, sản phẩm hoặc nhân vật.", icon: "🏷️" },
    ],
  },
  {
    id: "analytics",
    label: "Thống kê",
    key: "analytics",
    items: [
      { href: "/stats", title: "Dashboard sử dụng", description: "Theo dõi lượt dùng, chi phí, lỗi và độ trễ.", icon: "📊" },
    ],
  },
  {
    id: "dev-tools",
    label: "Công cụ dev",
    key: "dev tools",
    items: [
      { href: "/json", title: "JSON tools", description: "Format, kiểm tra và thao tác dữ liệu JSON.", icon: "{}" },
      { href: "/text", title: "Xử lý văn bản", description: "Đếm, chuyển đổi và làm sạch nội dung text.", icon: "🔤" },
      { href: "/encode", title: "Mã hoá", description: "Encode/decode URL, Base64 và các định dạng phổ biến.", icon: "🔐" },
      { href: "/hash", title: "Băm", description: "Tạo hash để kiểm tra chuỗi và dữ liệu.", icon: "#️⃣" },
      { href: "/random", title: "Ngẫu nhiên", description: "Sinh UUID, mật khẩu, số và dữ liệu ngẫu nhiên.", icon: "🎲" },
      { href: "/sql", title: "SQL", description: "Format, kiểm tra và thao tác truy vấn SQL.", icon: "🗄️" },
      { href: "/image", title: "Ảnh", description: "Xử lý, chuyển đổi và tối ưu ảnh nhanh.", icon: "🖼️" },
      { href: "/qr", title: "QR", description: "Tạo và đọc mã QR cho văn bản hoặc liên kết.", icon: "▣" },
      { href: "/fun", title: "ASCII/Emoji", description: "Tạo ASCII art, emoji và nội dung vui nhanh.", icon: "😄" },
      { href: "/regex", title: "Regex tester", description: "Thử biểu thức chính quy với dữ liệu mẫu.", icon: ".*" },
      { href: "/colors", title: "Color tools", description: "Chọn màu, chuyển đổi mã màu và palette.", icon: "🎨" },
      { href: "/time", title: "Timezone converter", description: "Chuyển đổi thời gian giữa các múi giờ.", icon: "🌏" },
      { href: "/md", title: "Markdown preview", description: "Xem trước Markdown và kiểm tra định dạng.", icon: "⬇️" },
      { href: "/doc", title: "Tiptap editor", description: "Soạn thảo tài liệu rich-text bằng Tiptap.", icon: "📄" },
      { href: "/sse-test", title: "SSE test", description: "Kiểm tra luồng server-sent events khi debug.", icon: "🧪" },
    ],
  },
  {
    id: "services-docs",
    label: "Dịch vụ & Tài liệu",
    key: "services legal medical social finance shopping",
    items: [
      { href: "/legal", title: "Tư vấn pháp lý", description: "Tư vấn, soạn thảo và kiểm tra hợp đồng, quy định.", icon: "⚖️" },
      { href: "/medical", title: "Tư vấn y tế", description: "Thông tin sức khỏe, triệu chứng, thuốc và chăm sóc.", icon: "⚕️" },
      { href: "/social", title: "Mạng xã hội", description: "Lập kế hoạch, sáng tác nội dung cho các nền tảng xã hội.", icon: "📱" },
      { href: "/finance", title: "Tài chính cá nhân", description: "Quản lý ngân sách, lập kế hoạch tài chính, đầu tư.", icon: "💰" },
      { href: "/shopping", title: "Hỗ trợ mua sắm", description: "Tìm sản phẩm, so sánh giá, gợi ý lựa chọn phù hợp.", icon: "🛍️" },
      { href: "/homework", title: "Hỗ trợ học tập", description: "Giải bài tập, giải thích bài học, ôn tập kỳ thi.", icon: "✏️" },
      { href: "/pitch", title: "Soạn pitch", description: "Lập kế hoạch và viết pitch thuyết phục cho startup hoặc dự án.", icon: "🎯" },
      { href: "/cover-letter", title: "Viết cover letter", description: "Soạn thảo cover letter chuyên nghiệp khi ứng tuyển công việc.", icon: "📮" },
    ],
  },
  {
    id: "help",
    label: "Trợ giúp",
    key: "help",
    items: [
      { href: "/hub", title: "Trung tâm tính năng", description: "Trang tổng hợp toàn bộ tính năng của Tans Agents.", icon: "🗂️" },
      { href: "/help", title: "Slash commands help", description: "Danh sách slash command và ví dụ sử dụng.", icon: "📘" },
      { href: "/shortcuts", title: "Phím tắt", description: "Các phím tắt giúp thao tác nhanh hơn.", icon: "⌨️" },
    ],
  },
]

const TOTAL_FEATURES = CATEGORIES.reduce((total, category) => total + category.items.length, 0)

function normalize(value: string) {
  return value.toLocaleLowerCase("vi-VN").trim()
}

export default function HubPage() {
  const [query, setQuery] = useState("")
  const normalizedQuery = normalize(query)

  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return CATEGORIES

    return CATEGORIES.map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        normalize(`${item.title} ${item.description} ${item.href} ${category.label} ${category.key}`).includes(normalizedQuery)
      ),
    })).filter((category) => category.items.length > 0)
  }, [normalizedQuery])

  const matchedCount = filteredCategories.reduce((total, category) => total + category.items.length, 0)

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl gap-8">
        <aside className="sticky top-8 hidden h-fit w-56 shrink-0 rounded-lg border bg-card p-3 lg:block">
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Nhóm tính năng</p>
          <nav className="space-y-1">
            {CATEGORIES.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="block rounded-md px-2 py-2 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
              >
                {category.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-8">
          <header className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  {TOTAL_FEATURES} tính năng
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tans Agents — Hub</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Tìm nhanh mọi trang AI, quản lý, cộng tác, thống kê và công cụ dev trong PWA.
                  </p>
                </div>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm theo tên hoặc mô tả..."
                  className="h-11 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  aria-label="Tìm kiếm tính năng"
                />
              </div>
            </div>
          </header>

          {filteredCategories.length === 0 ? (
            <section className="rounded-lg border bg-card p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xl">🔍</div>
              <h2 className="text-lg font-semibold">Không tìm thấy tính năng</h2>
              <p className="mt-2 text-sm text-muted-foreground">Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm.</p>
            </section>
          ) : (
            <div className="space-y-10">
              {filteredCategories.map((category) => (
                <section key={category.id} id={category.id} className="scroll-mt-8 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{category.label}</h2>
                      <p className="text-sm text-muted-foreground">{category.key}</p>
                    </div>
                    <span className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                      {category.items.length} mục
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {category.items.map((item) => (
                      <Link
                        key={`${category.id}-${item.href}-${item.title}`}
                        href={item.href}
                        className="group rounded-lg border bg-card p-4 transition hover:bg-muted/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-semibold">
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="truncate font-medium">{item.title}</h3>
                              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.description}</p>
                            <p className="mt-3 font-mono text-xs text-muted-foreground">{item.href}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {normalizedQuery && filteredCategories.length > 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Đang hiển thị {matchedCount}/{TOTAL_FEATURES} tính năng phù hợp.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  )
}
