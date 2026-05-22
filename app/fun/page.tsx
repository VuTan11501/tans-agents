"use client"

import { useMemo, useState } from "react"

const font: Record<string, string[]> = {
  A: [" ███ ", "█   █", "█████", "█   █", "█   █"],
  B: ["████ ", "█   █", "████ ", "█   █", "████ "],
  C: [" ████", "█    ", "█    ", "█    ", " ████"],
  D: ["████ ", "█   █", "█   █", "█   █", "████ "],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  F: ["█████", "█    ", "████ ", "█    ", "█    "],
  G: [" ████", "█    ", "█ ███", "█   █", " ███ "],
  H: ["█   █", "█   █", "█████", "█   █", "█   █"],
  I: ["█████", "  █  ", "  █  ", "  █  ", "█████"],
  J: ["█████", "   █ ", "   █ ", "█  █ ", " ██  "],
  K: ["█   █", "█  █ ", "███  ", "█  █ ", "█   █"],
  L: ["█    ", "█    ", "█    ", "█    ", "█████"],
  M: ["█   █", "██ ██", "█ █ █", "█   █", "█   █"],
  N: ["█   █", "██  █", "█ █ █", "█  ██", "█   █"],
  O: [" ███ ", "█   █", "█   █", "█   █", " ███ "],
  P: ["████ ", "█   █", "████ ", "█    ", "█    "],
  Q: [" ███ ", "█   █", "█ █ █", "█  █ ", " ██ █"],
  R: ["████ ", "█   █", "████ ", "█  █ ", "█   █"],
  S: [" ████", "█    ", " ███ ", "    █", "████ "],
  T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
  U: ["█   █", "█   █", "█   █", "█   █", " ███ "],
  V: ["█   █", "█   █", "█   █", " █ █ ", "  █  "],
  W: ["█   █", "█   █", "█ █ █", "██ ██", "█   █"],
  X: ["█   █", " █ █ ", "  █  ", " █ █ ", "█   █"],
  Y: ["█   █", " █ █ ", "  █  ", "  █  ", "  █  "],
  Z: ["█████", "   █ ", "  █  ", " █   ", "█████"],
  "0": [" ███ ", "█  ██", "█ █ █", "██  █", " ███ "],
  "1": ["  █  ", " ██  ", "  █  ", "  █  ", "█████"],
  "2": ["████ ", "    █", " ███ ", "█    ", "█████"],
  "3": ["████ ", "    █", " ███ ", "    █", "████ "],
  "4": ["█   █", "█   █", "█████", "    █", "    █"],
  "5": ["█████", "█    ", "████ ", "    █", "████ "],
  "6": [" ███ ", "█    ", "████ ", "█   █", " ███ "],
  "7": ["█████", "   █ ", "  █  ", " █   ", "█    "],
  "8": [" ███ ", "█   █", " ███ ", "█   █", " ███ "],
  "9": [" ███ ", "█   █", " ████", "    █", " ███ "],
}

const kaomoji = [
  "(^_^)", "(>_<)", "(╯°□°)╯︵ ┻━┻", "¯\\_(ツ)_/¯", "(◕‿◕)", "(づ｡◕‿‿◕｡)づ",
  "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "(ಥ﹏ಥ)", "(¬_¬)", "(｡♥‿♥｡)", "ʕ•ᴥ•ʔ", "(ง'̀-'́)ง",
  "(☞ﾟヮﾟ)☞", "☜(ﾟヮﾟ☜)", "(￣▽￣)", "(；一_一)", "(T_T)", "(^o^)/",
  "(｀・ω・´)", "(＾▽＾)", "(≧◡≦)", "(⌐■_■)", "(っ˘ω˘ς)", "(=^･ω･^=)",
  "(✿◠‿◠)", "(ﾉ´ヮ`)ﾉ*: ･ﾟ", "(＃`Д´)", "(￣ヘ￣)", "(ᵔᴥᵔ)", "(๑˃ᴗ˂)ﻭ",
  "(｡•́︿•̀｡)", "(☉_☉)", "(◔_◔)", "(๑•̀ㅂ•́)و✧", "(づ￣ ³￣)づ", "ヽ(•‿•)ノ",
]

const emojiGroups = [
  { name: "Mặt", items: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😍", "😘", "😋", "😜", "🤪"] },
  { name: "Cảm xúc", items: ["🥰", "😎", "🤩", "🥳", "😭", "🥺", "😤", "😡", "🤯", "😴", "🤔", "🤫", "🤗", "😱", "😬", "😌", "😈", "🤠"] },
  { name: "Hoạt động", items: ["👍", "👎", "👏", "🙌", "💪", "🙏", "🤝", "✌️", "🤞", "👌", "🫶", "💃", "🕺", "🏃", "🚴", "⚽", "🏀", "🎮"] },
  { name: "Đồ vật", items: ["💻", "📱", "⌚", "📷", "🎧", "🎤", "💡", "🔑", "✏️", "📚", "📌", "✂️", "🧰", "🔋", "🛠️", "🎁", "🧲", "🧪"] },
  { name: "Đồ ăn", items: ["🍣", "🍜", "🍙", "🍱", "🍔", "🍟", "🍕", "🌮", "🍰", "🍩", "☕", "🍵", "🍺", "🍎", "🍓", "🍉", "🥑", "🥐"] },
  { name: "Cờ", items: ["🇻🇳", "🇯🇵", "🇺🇸", "🇰🇷", "🇨🇳", "🇸🇬", "🇹🇭", "🇫🇷", "🇩🇪", "🇬🇧", "🇦🇺", "🇨🇦", "🇧🇷", "🇮🇳", "🇮🇩", "🇵🇭", "🇲🇾", "🇪🇺"] },
]

const squaredLetters = "🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉"
const squaredDigits = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"]
const mirrorMap: Record<string, string> = {
  a: "ɒ", b: "d", c: "ɔ", d: "b", e: "ɘ", f: "ꟻ", g: "ǫ", h: "ʜ", i: "i", j: "Ⴑ", k: "ʞ", l: "l", m: "m", n: "ᴎ", o: "o", p: "q", q: "p", r: "ɿ", s: "ƨ", t: "ʇ", u: "υ", v: "v", w: "w", x: "x", y: "ʏ", z: "ƹ",
  A: "A", B: "ᙠ", C: "Ɔ", D: "ᗡ", E: "Ǝ", F: "ꟻ", G: "Ꭾ", H: "H", I: "I", J: "Ⴑ", K: "ꓘ", L: "⅃", M: "M", N: "ᴎ", O: "O", P: "ꟼ", Q: "Ọ", R: "Я", S: "Ƨ", T: "T", U: "U", V: "V", W: "W", X: "X", Y: "Y", Z: "Ƹ",
  "0": "0", "1": "Ɩ", "2": "S", "3": "Ɛ", "4": "ᔭ", "5": "Ƽ", "6": "9", "7": "𝈒", "8": "8", "9": "6",
}

function renderAscii(input: string): string {
  const safe = input.toUpperCase().slice(0, 32)
  const rows = Array.from({ length: 5 }, (_, row) =>
    [...safe]
      .map((char) => {
        if (char === " ") return "     "
        return font[char]?.[row] ?? "?????"
      })
      .join("  "),
  )
  return rows.join("\n")
}

function mapUnicode(input: string, upperStart: number, lowerStart: number, digitStart: number): string {
  return [...input]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0
      if (code >= 65 && code <= 90) return String.fromCodePoint(upperStart + code - 65)
      if (code >= 97 && code <= 122) return String.fromCodePoint(lowerStart + code - 97)
      if (code >= 48 && code <= 57) return String.fromCodePoint(digitStart + code - 48)
      return char
    })
    .join("")
}

function squared(input: string): string {
  return [...input]
    .map((char) => {
      const code = char.toUpperCase().codePointAt(0) ?? 0
      if (code >= 65 && code <= 90) return [...squaredLetters][code - 65]
      if (code >= 48 && code <= 57) return squaredDigits[code - 48]
      return char
    })
    .join("")
}

function mirror(input: string): string {
  return [...input]
    .reverse()
    .map((char) => mirrorMap[char] ?? char)
    .join("")
}

export default function FunPage() {
  const [bannerText, setBannerText] = useState("TAN")
  const [decorateText, setDecorateText] = useState("Bold Mono 123")
  const [toast, setToast] = useState("")

  const ascii = useMemo(() => renderAscii(bannerText || " "), [bannerText])
  const decorations = useMemo(
    () => [
      { label: "Squared", value: squared(decorateText) },
      { label: "Mathematical Bold", value: mapUnicode(decorateText, 0x1d400, 0x1d41a, 0x1d7ce) },
      { label: "Monospace", value: mapUnicode(decorateText, 0x1d670, 0x1d68a, 0x1d7f6) },
      { label: "SPACED OUT", value: [...decorateText.toUpperCase()].join(" ") },
      { label: "Mirror", value: mirror(decorateText) },
    ],
    [decorateText],
  )

  const showToast = (value = "Đã sao chép!") => {
    setToast(value)
    window.setTimeout(() => setToast(""), 1500)
  }

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      showToast()
    } catch {
      showToast("Không thể sao chép")
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <p className="text-sm font-medium text-primary">Fun tools</p>
        <h1 className="text-2xl font-semibold tracking-tight">Công cụ vui nhộn</h1>
        <p className="text-sm text-muted-foreground">Tạo ASCII banner, copy kaomoji, emoji và trang trí chữ nhanh.</p>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-3 space-y-1">
          <h2 className="text-lg font-semibold">ASCII Banner</h2>
          <p className="text-sm text-muted-foreground">Hỗ trợ A-Z và 0-9, tối đa 32 ký tự.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
          <input
            value={bannerText}
            onChange={(event) => setBannerText(event.target.value)}
            placeholder="Nhập chữ..."
            className="h-11 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <pre className="min-h-36 overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-xs leading-5 text-foreground sm:text-sm">
            {ascii}
          </pre>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-3 space-y-1">
          <h2 className="text-lg font-semibold">Kaomoji</h2>
          <p className="text-sm text-muted-foreground">Bấm để copy biểu cảm Nhật Bản.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {kaomoji.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => copyText(item)}
              className="rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-3 space-y-1">
          <h2 className="text-lg font-semibold">Emoji picker</h2>
          <p className="text-sm text-muted-foreground">100+ emoji thông dụng, chia theo nhóm.</p>
        </div>
        <div className="space-y-4">
          {emojiGroups.map((group) => (
            <div key={group.name} className="space-y-2">
              <h3 className="text-sm font-medium">{group.name}</h3>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-9 lg:grid-cols-12">
                {group.items.map((emoji) => (
                  <button
                    key={`${group.name}-${emoji}`}
                    type="button"
                    onClick={() => copyText(emoji)}
                    className="rounded-lg border bg-background p-2 text-2xl hover:bg-muted"
                    aria-label={`Sao chép ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-3 space-y-1">
          <h2 className="text-lg font-semibold">Text decoration</h2>
          <p className="text-sm text-muted-foreground">Nhập chữ để tạo nhiều kiểu Unicode khác nhau.</p>
        </div>
        <div className="space-y-3">
          <input
            value={decorateText}
            onChange={(event) => setDecorateText(event.target.value)}
            placeholder="Nhập nội dung..."
            className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="grid gap-2">
            {decorations.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => copyText(item.value)}
                className="rounded-lg border bg-background p-3 text-left hover:bg-muted"
              >
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{item.label}</span>
                <span className="break-all text-sm">{item.value || "(trống)"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border bg-card px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  )
}
