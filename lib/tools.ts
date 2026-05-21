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
  description: "Search current web results. Uses Brave when configured, otherwise DuckDuckGo (HTML + Lite fallback).",
  parameters: z.object({ query: z.string().describe("Search query") }),
  execute: async ({ query }) => {
    try {
      const braveKey = process.env.BRAVE_SEARCH_API_KEY
      if (braveKey) {
        try {
          const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`
          const r = await fetch(url, {
            headers: { Accept: "application/json", "X-Subscription-Token": braveKey },
          })
          if (r.ok) {
            const data = await r.json()
            const results: SearchResult[] = (data.web?.results ?? []).slice(0, 5).map((item: any) => ({
              title: item.title ?? "",
              url: item.url ?? "",
              snippet: item.description ?? "",
            }))
            if (results.length > 0) return { source: "brave", results }
          }
        } catch {}
      }

      const ddgHtml = await tryDdgHtml(query)
      if (ddgHtml.length > 0) return { source: "ddg-html", results: ddgHtml }

      const ddgLite = await tryDdgLite(query)
      if (ddgLite.length > 0) return { source: "ddg-lite", results: ddgLite }

      const wiki = await tryWikipediaSearch(query)
      if (wiki.length > 0) return { source: "wikipedia-fallback", results: wiki, note: "DuckDuckGo bị chặn, dùng Wikipedia." }

      return { source: "ddg", results: [], note: "Không tìm thấy kết quả (search provider có thể đang bị rate-limit)." }
    } catch (e: unknown) {
      return { error: errorMessage(e, "search failed") }
    }
  },
})

async function tryDdgHtml(query: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
      },
      body: `q=${encodeURIComponent(query)}`,
    })
    if (!r.ok) return []
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
      if (finalUrl.includes("duckduckgo.com/y.js")) continue
      results.push({ title, url: finalUrl, snippet })
    }
    return results
  } catch {
    return []
  }
}

async function tryDdgLite(query: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
        Accept: "text/html",
      },
    })
    if (!r.ok) return []
    const html = await r.text()
    const results: SearchResult[] = []
    const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    const snippetRe = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g
    const links: Array<{ url: string; title: string }> = []
    let m: RegExpExecArray | null
    while ((m = linkRe.exec(html))) {
      links.push({
        url: m[1].startsWith("//") ? `https:${m[1]}` : m[1],
        title: m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
      })
    }
    const snippets: string[] = []
    while ((m = snippetRe.exec(html))) {
      snippets.push(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    }
    for (let i = 0; i < links.length && results.length < 5; i++) {
      if (links[i].url.includes("duckduckgo.com/y.js")) continue
      results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] ?? "" })
    }
    return results
  } catch {
    return []
  }
}

async function tryWikipediaSearch(query: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(
      `https://vi.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&origin=*`
    )
    if (!r.ok) return []
    const data = await r.json()
    const items = data?.query?.search ?? []
    return items.slice(0, 5).map((it: any) => ({
      title: it.title,
      url: `https://vi.wikipedia.org/wiki/${encodeURIComponent(it.title.replace(/ /g, "_"))}`,
      snippet: String(it.snippet ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    }))
  } catch {
    return []
  }
}

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
  description:
    "Generate an image from a text prompt via Pollinations.ai. " +
    "IMPORTANT — write the prompt as a detailed ENGLISH description (40+ words) covering: " +
    "subject, style (photoreal / anime / oil painting / 3D render…), lighting, mood, color palette, " +
    "camera angle, level of detail. Translate non-English user requests into rich English prompts. " +
    "Bad: 'cat'. Good: 'A fluffy orange tabby cat sitting on a wooden windowsill, warm afternoon sunlight, " +
    "soft bokeh background, photorealistic, high detail, shallow depth of field, cozy atmosphere'. " +
    "After the tool returns, reply with the markdown field exactly as-is (![alt](url)) plus a 1-2 sentence caption — " +
    "DO NOT call this tool again, DO NOT call any other tool. " +
    "Note: Pollinations renders on-demand server-side (15-30s on first load); the UI shows a loading skeleton.",
  parameters: z.object({
    prompt: z.string().describe("DETAILED English description (40+ words). Translate non-English requests."),
    width: z.number().int().min(64).max(2048).optional().default(1024),
    height: z.number().int().min(64).max(2048).optional().default(1024),
  }),
  execute: async ({ prompt, width, height }) => {
    // Server-side prompt enhancement fallback: if the model passed a tiny / non-English prompt,
    // expand it via Groq llama-3.1-8b-instant (free, ~500ms) so the user still gets a quality image.
    let finalPrompt = prompt.trim()
    const hasNonAscii = /[^\x00-\x7F]/.test(finalPrompt)
    const tooShort = finalPrompt.split(/\s+/).filter(Boolean).length < 6
    if ((hasNonAscii || tooShort) && process.env.GROQ_API_KEY) {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 6_000)
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            max_tokens: 180,
            messages: [
              {
                role: "system",
                content:
                  "Rewrite the user's image idea as ONE detailed English image-generation prompt (40-70 words). " +
                  "Include: subject, style (photoreal/anime/3D/oil…), lighting, mood, composition, detail level. " +
                  "No preamble. No quotes. Just the prompt.",
              },
              { role: "user", content: finalPrompt },
            ],
          }),
        })
        clearTimeout(timer)
        if (r.ok) {
          const data = await r.json()
          const enhanced = data?.choices?.[0]?.message?.content?.trim()
          if (typeof enhanced === "string" && enhanced.length > finalPrompt.length) {
            finalPrompt = enhanced.replace(/^["'`]|["'`]$/g, "")
          }
        }
      } catch {
        /* enhancement is best-effort; fall back to original prompt */
      }
    }
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&nologo=true`
    return {
      url,
      markdown: `![${finalPrompt.slice(0, 120)}](${url})`,
      ...(finalPrompt !== prompt.trim() ? { enhancedPrompt: finalPrompt } : {}),
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


const FETCH_TIMEOUT_MS = 8000

async function fetchJsonWithTimeout(url: string, init: RequestInit = {}): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

export const runJs = tool({
  description: "Chạy JavaScript trong worker sandbox. Dùng để test snippet, tính toán, parse data.",
  parameters: z.object({ code: z.string().describe("JavaScript source code") }),
  execute: async ({ code }) => ({ code }),
})

export const cryptoPrice = tool({
  description: "Lấy giá crypto hiện tại (USD + VND, biến động 24h). Dùng CoinGecko free API.",
  parameters: z.object({ symbol: z.string().describe("Coin id like bitcoin, ethereum, solana") }),
  execute: async ({ symbol }) => {
    try {
      const id = symbol.trim().toLowerCase()
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd,vnd&include_24hr_change=true`
      const data = await fetchJsonWithTimeout(url, { headers: { Accept: "application/json" } })
      const coin = data?.[id]
      if (!coin) return { error: `Không tìm thấy coin id: ${symbol}` }
      return {
        symbol: id,
        usd: coin.usd,
        vnd: coin.vnd,
        change24h: coin.usd_24h_change,
      }
    } catch (e: unknown) {
      return { error: errorMessage(e, "crypto price failed") }
    }
  },
})

export const stockPrice = tool({
  description: "Lấy giá cổ phiếu (Yahoo Finance). Hỗ trợ ticker quốc tế (AAPL, TSLA, VNM.VN, ...).",
  parameters: z.object({ ticker: z.string().describe("Stock ticker symbol, e.g. AAPL or VNM.VN") }),
  execute: async ({ ticker }) => {
    try {
      const symbol = ticker.trim().toUpperCase()
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
      const data = await fetchJsonWithTimeout(url, { headers: { Accept: "application/json" } })
      const result = data?.chart?.result?.[0]
      if (!result) return { error: `Không tìm thấy ticker: ${ticker}` }
      const meta = result.meta ?? {}
      const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((value: unknown): value is number => typeof value === "number")
      const price = typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : closes[closes.length - 1]
      const previous = typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose : closes[closes.length - 2]
      const change = typeof price === "number" && typeof previous === "number" ? price - previous : undefined
      const changePct = typeof change === "number" && previous ? (change / previous) * 100 : undefined
      return {
        ticker: symbol,
        price,
        change,
        changePct,
        currency: meta.currency ?? "",
      }
    } catch (e: unknown) {
      return { error: errorMessage(e, "stock price failed") }
    }
  },
})

export const translate = tool({
  description: "Dịch văn bản giữa các ngôn ngữ (MyMemory free API).",
  parameters: z.object({
    text: z.string().describe("Text to translate"),
    targetLang: z.string().describe("Target language code: vi, en, ja, ko, zh, ..."),
    sourceLang: z.string().optional().describe("Source language code; omit for auto-detect"),
  }),
  execute: async ({ text, targetLang, sourceLang }) => {
    try {
      const source = sourceLang?.trim() || "auto"
      const target = targetLang.trim()
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${source}|${target}`)}`
      const data = await fetchJsonWithTimeout(url, { headers: { Accept: "application/json" } })
      return {
        translatedText: data?.responseData?.translatedText ?? "",
        sourceLang: source,
        targetLang: target,
      }
    } catch (e: unknown) {
      return { error: errorMessage(e, "translate failed") }
    }
  },
})

export const githubQuery = tool({
  description: "Truy vấn GitHub: repo info, issue/PR đang mở, search code, user profile.",
  parameters: z.object({
    kind: z.enum(["repo", "issues", "prs", "code", "user"]).describe("Loại truy vấn"),
    query: z.string().describe("owner/repo (cho repo/issues/prs) HOẶC keyword (cho code/user)"),
  }),
  execute: async ({ kind, query }) => {
    try {
      const headers = {
        Accept: "application/vnd.github+json",
        "User-Agent": "tans-agents",
      }
      if (kind === "repo") {
        const repo = parseGitHubRepo(query)
        if (!repo) return { error: "Repo phải có dạng owner/repo" }
        const data = await fetchJsonWithTimeout(`https://api.github.com/repos/${repo}`, { headers })
        return {
          name: data.full_name,
          description: data.description,
          url: data.html_url,
          stars: data.stargazers_count,
          forks: data.forks_count,
          openIssues: data.open_issues_count,
          language: data.language,
          updatedAt: data.updated_at,
        }
      }
      if (kind === "issues") {
        const repo = parseGitHubRepo(query)
        if (!repo) return { error: "Issues cần query dạng owner/repo" }
        const data = await fetchJsonWithTimeout(`https://api.github.com/repos/${repo}/issues?state=open&per_page=10`, { headers })
        return {
          repo,
          issues: (Array.isArray(data) ? data : [])
            .filter((item: any) => !item.pull_request)
            .slice(0, 10)
            .map((item: any) => ({ number: item.number, title: item.title, url: item.html_url, author: item.user?.login, labels: (item.labels ?? []).map((label: any) => label.name) })),
        }
      }
      if (kind === "prs") {
        const repo = parseGitHubRepo(query)
        if (!repo) return { error: "PRs cần query dạng owner/repo" }
        const data = await fetchJsonWithTimeout(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=10`, { headers })
        return {
          repo,
          prs: (Array.isArray(data) ? data : []).slice(0, 10).map((item: any) => ({ number: item.number, title: item.title, url: item.html_url, author: item.user?.login, branch: item.head?.ref })),
        }
      }
      if (kind === "code") {
        const data = await fetchJsonWithTimeout(`https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=10`, { headers })
        return {
          totalCount: data.total_count ?? 0,
          items: (data.items ?? []).slice(0, 10).map((item: any) => ({ name: item.name, path: item.path, repo: item.repository?.full_name, url: item.html_url })),
        }
      }
      const login = query.trim()
      const data = await fetchJsonWithTimeout(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers })
      return {
        login: data.login,
        name: data.name,
        bio: data.bio,
        url: data.html_url,
        company: data.company,
        location: data.location,
        followers: data.followers,
        publicRepos: data.public_repos,
      }
    } catch (e: unknown) {
      return { error: errorMessage(e, "github query failed") }
    }
  },
})

function parseGitHubRepo(query: string): string | null {
  const match = query.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/)
  return match ? `${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}` : null
}

export const emailCompose = tool({
  description: "Soạn email draft. Trả về mailto: link để mở client email.",
  parameters: z.object({
    to: z.string().optional().describe("Email người nhận"),
    subject: z.string().describe("Tiêu đề email"),
    body: z.string().describe("Nội dung email"),
    cc: z.string().optional().describe("Email CC (tuỳ chọn)"),
  }),
  execute: async ({ to, subject, body, cc }) => {
    try {
      const params = new URLSearchParams()
      params.set("subject", subject)
      params.set("body", body)
      if (cc) params.set("cc", cc)
      return { to, subject, body, cc, mailto: `mailto:${encodeURIComponent(to ?? "")}?${params.toString()}` }
    } catch (e: unknown) {
      return { error: errorMessage(e, "email compose failed") }
    }
  },
})

export const searchCollection = tool({
  description:
    "Stub RAG: server không đọc được IndexedDB. Context từ collection active sẽ được client tự động chèn trước khi gửi tin nhắn.",
  parameters: z.object({
    query: z.string().optional().describe("Câu hỏi hoặc từ khoá cần tìm"),
  }),
  execute: async ({ query }) => ({
    query,
    note: "Hãy dùng thiết lập collection active trong UI; ngữ cảnh RAG sẽ được tự động chèn từ trình duyệt trước khi gửi.",
  }),
})

export const agentTools = { currentTime, calculator, webSearch, weather, wikipedia, fetchUrl, generateImage, chartGen, mermaid, runPython, runJs, cryptoPrice, stockPrice, translate, githubQuery, emailCompose, searchCollection }
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
  runJs: "Chạy JavaScript",
  cryptoPrice: "Giá crypto",
  stockPrice: "Giá cổ phiếu",
  translate: "Dịch văn bản",
  githubQuery: "Truy vấn GitHub",
  emailCompose: "Soạn email",
  searchCollection: "Tìm tài liệu",
}
