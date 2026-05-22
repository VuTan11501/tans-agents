"use client"

import { useMemo, useState } from "react"

type EccLevel = "L" | "M" | "Q" | "H"

const presets = [
  { label: "WiFi", value: "WIFI:T:WPA;S:MyNetwork;P:password;;" },
  { label: "Email", value: "mailto:example@email.com?subject=Hi&body=Hello" },
  { label: "Tel", value: "tel:+84..." },
  { label: "SMS", value: "sms:+84...?body=Hi" },
  {
    label: "vCard",
    value: "BEGIN:VCARD\nVERSION:3.0\nFN:Nguyen Van A\nTEL:+84900000000\nEMAIL:a@example.com\nEND:VCARD",
  },
  { label: "Google Maps", value: "https://maps.google.com/?q=10.762622,106.660172" },
]

function hexForQr(value: string): string {
  return value.replace("#", "")
}

function makeQrUrl(data: string, size: number, ecc: EccLevel, color: string, bgColor: string): string {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data,
    ecc,
    color: hexForQr(color),
    bgcolor: hexForQr(bgColor),
    margin: "10",
  })
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`
}

export default function QRPage() {
  const [text, setText] = useState("https://example.com")
  const [size, setSize] = useState(300)
  const [ecc, setEcc] = useState<EccLevel>("M")
  const [color, setColor] = useState("#000000")
  const [bgColor, setBgColor] = useState("#ffffff")
  const [message, setMessage] = useState("")
  const [downloading, setDownloading] = useState(false)

  const qrUrl = useMemo(() => makeQrUrl(text || " ", size, ecc, color, bgColor), [bgColor, color, ecc, size, text])

  const showMessage = (value: string) => {
    setMessage(value)
    window.setTimeout(() => setMessage(""), 1800)
  }

  const downloadQr = async () => {
    if (!text.trim()) {
      showMessage("Vui lòng nhập nội dung QR")
      return
    }

    try {
      setDownloading(true)
      const response = await fetch(qrUrl)
      if (!response.ok) throw new Error("Không tải được ảnh QR")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "qr.png"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showMessage("Đã tải xuống qr.png")
    } catch {
      showMessage("Không thể tải QR. Thử lại sau nhé.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">Công cụ QR</p>
          <h1 className="text-2xl font-semibold tracking-tight">Tạo mã QR miễn phí</h1>
          <p className="text-sm text-muted-foreground">
            Nhập URL, WiFi, văn bản, vCard hoặc dữ liệu bất kỳ để xem QR trực tiếp.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
          <div className="space-y-2">
            <label htmlFor="qr-text" className="text-sm font-medium">
              Nội dung QR
            </label>
            <textarea
              id="qr-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Dán URL hoặc nhập nội dung ở đây..."
              className="min-h-36 w-full rounded-lg border bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="qr-size" className="text-sm font-medium">
                Kích thước
              </label>
              <select
                id="qr-size"
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {[200, 300, 500, 800].map((value) => (
                  <option key={value} value={value}>
                    {value} × {value} px
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="qr-ecc" className="text-sm font-medium">
                Mức sửa lỗi
              </label>
              <select
                id="qr-ecc"
                value={ecc}
                onChange={(event) => setEcc(event.target.value as EccLevel)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="L">L - Thấp</option>
                <option value="M">M - Trung bình</option>
                <option value="Q">Q - Cao</option>
                <option value="H">H - Rất cao</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="qr-color" className="text-sm font-medium">
                Màu QR
              </label>
              <div className="flex gap-2 rounded-lg border bg-background p-2">
                <input
                  id="qr-color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                />
                <input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  aria-label="Mã màu QR"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="qr-bg" className="text-sm font-medium">
                Màu nền
              </label>
              <div className="flex gap-2 rounded-lg border bg-background p-2">
                <input
                  id="qr-bg"
                  type="color"
                  value={bgColor}
                  onChange={(event) => setBgColor(event.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                />
                <input
                  value={bgColor}
                  onChange={(event) => setBgColor(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  aria-label="Mã màu nền"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium">Mẫu nhanh</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setText(preset.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="flex aspect-square w-full max-w-[300px] items-center justify-center rounded-lg border bg-white p-3">
              <img src={qrUrl} alt="Mã QR" width={300} height={300} className="h-full w-full object-contain" />
            </div>
            <p className="w-full break-all rounded-lg bg-muted p-3 text-xs text-muted-foreground">{text || "Chưa có nội dung"}</p>
            <button
              type="button"
              onClick={downloadQr}
              disabled={downloading}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloading ? "Đang tải..." : "Tải xuống"}
            </button>
            {message ? <p className="text-center text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </aside>
      </div>
    </main>
  )
}
