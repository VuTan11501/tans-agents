"use client"

import { useMemo, useState } from "react"

type Mode = "encode" | "decode"
type Codec = {
  id: string
  title: string
  description: string
  encodeLabel: string
  decodeLabel: string
  sample: string
  encode: (value: string) => string
  decode: (value: string) => string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function safeRun(action: () => string) {
  try {
    return action()
  } catch (error) {
    return `Không thể xử lý: ${error instanceof Error ? error.message : "dữ liệu không hợp lệ"}`
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value.trim())
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function textToHex(value: string) {
  return Array.from(encoder.encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ")
}

function hexToText(value: string) {
  const cleaned = value.replace(/0x/gi, "").replace(/[^0-9a-fA-F]/g, "")
  if (cleaned.length % 2 !== 0) throw new Error("Chuỗi hex phải có số ký tự chẵn.")
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let index = 0; index < cleaned.length; index += 2) {
    bytes[index / 2] = Number.parseInt(cleaned.slice(index, index + 2), 16)
  }
  return decoder.decode(bytes)
}

function encodeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }
  return value.replace(/[&<>"']/g, (char) => entities[char])
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  }

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    return named[entity] ?? match
  })
}

function rot13(value: string) {
  return value.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97
    return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base)
  })
}

function textToBinary(value: string) {
  return Array.from(encoder.encode(value))
    .map((byte) => byte.toString(2).padStart(8, "0"))
    .join(" ")
}

function binaryToText(value: string) {
  const cleaned = value.replace(/\s+/g, "")
  if (!/^[01]*$/.test(cleaned)) throw new Error("Binary chỉ được chứa 0 và 1.")
  if (cleaned.length % 8 !== 0) throw new Error("Số bit phải chia hết cho 8.")
  const bytes = new Uint8Array(cleaned.length / 8)
  for (let index = 0; index < cleaned.length; index += 8) {
    bytes[index / 8] = Number.parseInt(cleaned.slice(index, index + 8), 2)
  }
  return decoder.decode(bytes)
}

const codecs: Codec[] = [
  {
    id: "base64",
    title: "Base64",
    description: "Mã hoá/giải mã Base64, hỗ trợ Unicode bằng TextEncoder/TextDecoder.",
    encodeLabel: "Encode Base64",
    decodeLabel: "Decode Base64",
    sample: "Xin chào Việt Nam 🚀",
    encode: (value) => safeRun(() => bytesToBase64(encoder.encode(value))),
    decode: (value) => safeRun(() => decoder.decode(base64ToBytes(value))),
  },
  {
    id: "url",
    title: "URL Encode",
    description: "Dùng encodeURIComponent/decodeURIComponent cho query string hoặc slug tham số.",
    encodeLabel: "URL encode",
    decodeLabel: "URL decode",
    sample: "xin chào?name=Tan VC&city=Tokyo",
    encode: (value) => safeRun(() => encodeURIComponent(value)),
    decode: (value) => safeRun(() => decodeURIComponent(value)),
  },
  {
    id: "hex",
    title: "Hex",
    description: "Chuyển text sang chuỗi hex cách nhau bằng khoảng trắng và ngược lại.",
    encodeLabel: "Text → Hex",
    decodeLabel: "Hex → Text",
    sample: "TanVC",
    encode: (value) => safeRun(() => textToHex(value)),
    decode: (value) => safeRun(() => hexToText(value)),
  },
  {
    id: "html",
    title: "HTML Entities",
    description: "Escape các ký tự HTML phổ biến như &, <, >, dấu nháy.",
    encodeLabel: "Encode HTML",
    decodeLabel: "Decode HTML",
    sample: `<div class="card">Tan & AI</div>`,
    encode: (value) => safeRun(() => encodeHtml(value)),
    decode: (value) => safeRun(() => decodeHtml(value)),
  },
  {
    id: "rot13",
    title: "ROT13",
    description: "Dịch vòng 13 ký tự cho chữ Latin; encode và decode là cùng một phép biến đổi.",
    encodeLabel: "ROT13 encode",
    decodeLabel: "ROT13 decode",
    sample: "Hello TanVC",
    encode: (value) => rot13(value),
    decode: (value) => rot13(value),
  },
  {
    id: "binary",
    title: "Binary",
    description: "Chuyển text Unicode sang byte nhị phân 8-bit và giải mã ngược lại.",
    encodeLabel: "Text → Binary",
    decodeLabel: "Binary → Text",
    sample: "AI",
    encode: (value) => safeRun(() => textToBinary(value)),
    decode: (value) => safeRun(() => binaryToText(value)),
  },
]

function CodecCard({ codec }: { codec: Codec }) {
  const [mode, setMode] = useState<Mode>("encode")
  const [input, setInput] = useState(codec.sample)
  const [copied, setCopied] = useState(false)
  const output = useMemo(() => (mode === "encode" ? codec.encode(input) : codec.decode(input)), [codec, input, mode])

  const copy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{codec.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{codec.description}</p>
        </div>
        <div className="flex rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setMode("encode")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "encode" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Encode
          </button>
          <button
            type="button"
            onClick={() => setMode("decode")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "decode" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Decode
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Input
          <textarea
            className="min-h-40 w-full rounded-lg border bg-background p-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Nhập dữ liệu..."
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Output
          <textarea
            className="min-h-40 w-full rounded-lg border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground"
            value={output}
            readOnly
            placeholder="Kết quả..."
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("encode")}
          className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          {codec.encodeLabel}
        </button>
        <button
          type="button"
          onClick={() => setMode("decode")}
          className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          {codec.decodeLabel}
        </button>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          {copied ? "Đã copy" : "Copy"}
        </button>
      </div>
    </section>
  )
}

export default function EncodeToolsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <section className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Công cụ mã hoá</p>
        <h1 className="text-3xl font-bold tracking-tight">Encode / Decode nhanh</h1>
        <p className="text-muted-foreground">Các bộ chuyển đổi độc lập cho Base64, URL, Hex, HTML entities, ROT13 và Binary. Không dùng thư viện ngoài.</p>
      </section>

      <div className="grid gap-4">
        {codecs.map((codec) => (
          <CodecCard key={codec.id} codec={codec} />
        ))}
      </div>
    </main>
  )
}
