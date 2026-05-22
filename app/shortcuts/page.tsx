import Link from "next/link"

const shortcutGroups = [
  {
    title: "Chung",
    items: [
      ["Ctrl+K", "Tìm trong hội thoại"],
      ["Ctrl+/", "Hiện danh sách slash commands"],
      ["Esc", "Đóng modal"],
      ["?", "Mở phím tắt (trang này)"],
    ],
  },
  {
    title: "Soạn thảo",
    items: [
      ["Enter", "Gửi tin nhắn"],
      ["Shift+Enter", "Xuống dòng"],
    ],
  },
  {
    title: "Slash commands",
    items: [
      ["/help", "Mở hướng dẫn"],
      ["/clear", "Xoá hội thoại hiện tại"],
      ["/summarize", "Tóm tắt nội dung"],
      ["/translate", "Dịch nội dung"],
      ["/code", "Hỗ trợ viết hoặc sửa code"],
      ["/explain", "Giải thích nội dung"],
      ["/rewrite", "Viết lại nội dung"],
    ],
  },
]

export default function ShortcutsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Phím tắt</h1>
          <p className="text-sm text-muted-foreground">Bảng tra nhanh phím tắt và slash commands.</p>
        </div>
        <Link href="/" className="shrink-0 text-sm text-muted-foreground hover:underline">
          ← Quay lại
        </Link>
      </header>

      <div className="space-y-5">
        {shortcutGroups.map((group) => (
          <section key={group.title} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-base font-semibold">{group.title}</h2>
            </div>
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-1/3 px-4 py-3 font-medium">Phím / Lệnh</th>
                    <th className="px-4 py-3 font-medium">Chức năng</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(([key, description]) => (
                    <tr key={key} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 align-top">
                        <kbd className="rounded-md border bg-muted px-2 py-1 font-mono text-xs text-foreground">
                          {key}
                        </kbd>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
