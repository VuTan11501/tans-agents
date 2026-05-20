import { tool } from "ai"
import { z } from "zod"

export const currentTime = tool({
  description: "Get the current date and time in ISO format. Use when user asks about time/date.",
  parameters: z.object({}),
  execute: async () => {
    try {
      return { now: new Date().toISOString() }
    } catch (e: unknown) {
      return { error: errorMessage(e, "time failed") }
    }
  },
})

export const calculator = tool({
  description: "Evaluate a simple math expression. Only digits and + - * / ( ) . are allowed.",
  parameters: z.object({ expression: z.string().describe("e.g. '12 * 34 + 5'") }),
  execute: async ({ expression }) => {
    try {
      if (!/^[\d+\-*/().\s]+$/.test(expression)) return { error: "invalid characters" }
      const result = safeEval(expression)
      return { result }
    } catch (e: unknown) {
      return { error: errorMessage(e, "eval error") }
    }
  },
})

// Safe arithmetic parser (no eval/Function): shunting-yard
function safeEval(expr: string): number {
  const tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/()]/g) || []
  const out: (number | string)[] = []
  const ops: string[] = []
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 }
  for (const t of tokens) {
    if (/^\d/.test(t)) {
      out.push(Number(t))
    } else if (t === "(") {
      ops.push(t)
    } else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()!)
      if (ops.pop() !== "(") throw new Error("mismatched parens")
    } else {
      while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]] >= prec[t]) {
        out.push(ops.pop()!)
      }
      ops.push(t)
    }
  }
  while (ops.length) {
    const o = ops.pop()!
    if (o === "(" || o === ")") throw new Error("mismatched parens")
    out.push(o)
  }
  const stack: number[] = []
  for (const tok of out) {
    if (typeof tok === "number") {
      stack.push(tok)
    } else {
      const b = stack.pop()!
      const a = stack.pop()!
      if (tok === "+") stack.push(a + b)
      else if (tok === "-") stack.push(a - b)
      else if (tok === "*") stack.push(a * b)
      else if (tok === "/") stack.push(a / b)
    }
  }
  if (stack.length !== 1) throw new Error("invalid expression")
  return stack[0]
}

type SearchResult = { title: string; url: string; snippet: string }

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
}

function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  }

  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x"
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ""
    }
    return named[entity] ?? `&${entity};`
  })
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? stripHtml(match[1]) : ""
}

function weatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
  }
  return descriptions[code] ?? "Unknown"
}

export const webSearch = tool({
  description: "Search current web results. Uses Brave when configured, otherwise DuckDuckGo.",
  parameters: z.object({ query: z.string().describe("Search query") }),
  execute: async ({ query }) => {
    try {
      const braveKey = process.env.BRAVE_SEARCH_API_KEY
      if (braveKey) {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`
        const r = await fetch(url, {
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": braveKey,
          },
        })
        if (!r.ok) throw new Error(`Brave search failed: ${r.status}`)
        const data = await r.json()
        const results: SearchResult[] = (data.web?.results ?? []).slice(0, 5).map((item: any) => ({
          title: item.title ?? "",
          url: item.url ?? "",
          snippet: item.description ?? "",
        }))
        return { source: "brave", results }
      }

      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "text/html",
        },
        body: `q=${encodeURIComponent(query)}`,
      })
      if (!r.ok) throw new Error(`DuckDuckGo search failed: ${r.status}`)
      const html = await r.text()
      const results: SearchResult[] = []
      const blockRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
      let m: RegExpExecArray | null
      while ((m = blockRe.exec(html)) && results.length < 5) {
        const rawUrl = m[1]
        const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
        const snippet = m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
        let finalUrl = rawUrl
        try {
          const u = new URL(rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl)
          const uddg = u.searchParams.get("uddg")
          if (uddg) finalUrl = decodeURIComponent(uddg)
        } catch {}
        results.push({ title, url: finalUrl, snippet })
      }
      if (results.length === 0) {
        return { source: "ddg", results: [], note: "Không tìm thấy kết quả." }
      }
      return { source: "ddg", results }
    } catch (e: unknown) {
      return { error: errorMessage(e, "search failed") }
    }
  },
})

export const weather = tool({
  description: "Get current weather for a city or place using Open-Meteo. Use for weather questions.",
  parameters: z.object({ location: z.string().describe("City or place name, e.g. Hanoi") }),
  execute: async ({ location }) => {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
      const geoResponse = await fetch(geoUrl)
      if (!geoResponse.ok) throw new Error(`geocoding failed: ${geoResponse.status}`)
      const geoData = await geoResponse.json()
      const place = geoData.results?.[0]
      if (!place) return { error: `location not found: ${location}` }

      const forecastUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
        "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto"
      const forecastResponse = await fetch(forecastUrl)
      if (!forecastResponse.ok) throw new Error(`weather fetch failed: ${forecastResponse.status}`)
      const forecast = await forecastResponse.json()
      const current = forecast.current ?? {}
      return {
        location: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
        current: {
          time: current.time,
          temperature_2m: current.temperature_2m,
          relative_humidity_2m: current.relative_humidity_2m,
          precipitation: current.precipitation,
          weather_code: current.weather_code,
          weather_description: weatherDescription(current.weather_code),
          wind_speed_10m: current.wind_speed_10m,
          units: forecast.current_units ?? {},
        },
      }
    } catch (e: unknown) {
      return { error: errorMessage(e, "weather failed") }
    }
  },
})

export const wikipedia = tool({
  description: "Find a short Wikipedia summary. Use for encyclopedia-style background facts.",
  parameters: z.object({
    query: z.string().describe("Topic to search"),
    lang: z.enum(["vi", "en"]).optional().default("vi"),
  }),
  execute: async ({ query, lang }) => {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`
      const searchResponse = await fetch(searchUrl)
      if (!searchResponse.ok) throw new Error(`Wikipedia search failed: ${searchResponse.status}`)
      const searchData = await searchResponse.json()
      const title = searchData?.[1]?.[0]
      if (!title) return { error: `no Wikipedia result for: ${query}` }

      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      const summaryResponse = await fetch(summaryUrl, { headers: { Accept: "application/json" } })
      if (!summaryResponse.ok) throw new Error(`Wikipedia summary failed: ${summaryResponse.status}`)
      const summary = await summaryResponse.json()
      return {
        title: summary.title ?? title,
        extract: summary.extract ?? "",
        url: summary.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      }
    } catch (e: unknown) {
      return { error: errorMessage(e, "wikipedia failed") }
    }
  },
})

export const fetchUrl = tool({
  description: "Fetch a public URL and extract readable HTML text. Use when user asks to read a webpage.",
  parameters: z.object({ url: z.string().url().describe("HTTP or HTTPS URL to fetch") }),
  execute: async ({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { error: "only http/https URLs are supported" }
      const response = await fetch(parsed.toString(), { headers: { Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8" } })
      if (!response.ok) throw new Error(`fetch failed: ${response.status}`)
      const html = await response.text()
      return {
        url: parsed.toString(),
        title: extractTitle(html),
        text: stripHtml(html).slice(0, 8000),
      }
    } catch (e: unknown) {
      return { error: errorMessage(e, "fetch URL failed") }
    }
  },
})

export const generateImage = tool({
  description: "Create an image URL from a prompt with Pollinations.ai. Use for image generation requests.",
  parameters: z.object({
    prompt: z.string().describe("Image prompt"),
    width: z.number().int().min(64).max(2048).optional().default(1024),
    height: z.number().int().min(64).max(2048).optional().default(1024),
  }),
  execute: async ({ prompt, width, height }) => {
    try {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true`
      return { url, markdown: `![${prompt}](${url})` }
    } catch (e: unknown) {
      return { error: errorMessage(e, "image generation failed") }
    }
  },
})

export const chartGen = tool({
  description:
    "Tạo dữ liệu biểu đồ để client vẽ SVG. Use when the user asks for a chart, graph, visualization, comparison, trend, or data breakdown.",
  parameters: z.object({
    type: z.enum(["line", "bar", "pie"]).describe("Chart type: line for trends, bar for comparisons, pie for proportions"),
    title: z.string().describe("Chart title"),
    labels: z.array(z.string()).describe("Labels for each data point"),
    data: z.array(z.number()).describe("Numeric values matching labels by index"),
  }),
  execute: async ({ type, title, labels, data }) => ({ type, title, labels, data }),
})

export const mermaid = tool({
  description:
    "Tạo sơ đồ Mermaid từ cú pháp hợp lệ. Use for flowcharts, sequence diagrams, class diagrams, ER diagrams, state diagrams, mindmaps, and architecture diagrams.",
  parameters: z.object({
    code: z.string().describe("Valid Mermaid diagram syntax"),
    title: z.string().optional().describe("Optional diagram title"),
  }),
  execute: async ({ code, title }) => ({ code, title }),
})

export const runPython = tool({
  description:
    "Chạy mã Python trực tiếp trong trình duyệt (Pyodide WASM). Dùng khi user yêu cầu tính toán, phân tích số liệu, vẽ matplotlib, hoặc test snippet Python. Không cần cài đặt.",
  parameters: z.object({ code: z.string().describe("Python source code to execute") }),
  execute: async ({ code }) => ({ code }),
})

export const searchCollection = tool({
  description:
    "Tìm trong tài liệu cá nhân (RAG). Dùng khi user muốn tra cứu PDF/MD/TXT đã upload vào Bộ tài liệu cá nhân.",
  parameters: z.object({
    query: z.string().describe("Câu hỏi hoặc từ khoá cần tìm"),
    collectionId: z.string().describe("ID collection trong IndexedDB"),
    topK: z.number().int().min(1).max(10).optional().default(5),
  }),
  execute: async ({ query, collectionId, topK }) => ({
    query,
    collectionId,
    topK,
    note: "Bộ tài liệu cá nhân được lưu trong IndexedDB của trình duyệt, nên server chat không thể đọc trực tiếp. Hãy mở Bộ tài liệu trên header để tìm kiếm cục bộ.",
  }),
})

export const agentTools = { currentTime, calculator, webSearch, weather, wikipedia, fetchUrl, generateImage, chartGen, mermaid, runPython, searchCollection }
export const TOOL_NAMES = Object.keys(agentTools)
export const TOOL_LABELS: Record<keyof typeof agentTools, string> = {
  currentTime: "Thời gian",
  calculator: "Máy tính",
  webSearch: "Tìm web",
  weather: "Thời tiết",
  wikipedia: "Wikipedia",
  fetchUrl: "Đọc URL",
  generateImage: "Tạo ảnh",
  chartGen: "Vẽ biểu đồ",
  mermaid: "Vẽ sơ đồ",
  runPython: "Chạy Python",
  searchCollection: "Tìm tài liệu",
}
