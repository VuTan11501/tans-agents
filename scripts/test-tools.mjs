// Test tool-calling support across all configured models.
import { readFileSync } from "node:fs"
import { streamText, tool } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"

// Tiny inline .env.local loader (avoids extra dep)
try {
  const env = readFileSync(".env.local", "utf8")
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {}

const PROVIDERS = {
  google: {
    models: [
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ],
  },
  groq: {
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3-32b",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ],
  },
  github: {
    models: [
      "gpt-4o-mini",
      "gpt-4o",
      "Meta-Llama-3.1-8B-Instruct",
      "Meta-Llama-3.1-405B-Instruct",
    ],
  },
}

const tools = {
  calculator: tool({
    description: "Evaluate a math expression. Use for arithmetic.",
    parameters: z.object({ expression: z.string() }),
    execute: async ({ expression }) => {
      const r = Function(`"use strict";return (${expression})`)()
      return { result: r }
    },
  }),
  currentTime: tool({
    description: "Get current ISO date-time.",
    parameters: z.object({}),
    execute: async () => ({ now: new Date().toISOString() }),
  }),
}

function build(provider, modelId) {
  if (provider === "google")
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId)
  if (provider === "groq") return createGroq({ apiKey: process.env.GROQ_API_KEY })(modelId)
  if (provider === "github")
    return createOpenAI({
      apiKey: process.env.GITHUB_TOKEN,
      baseURL: "https://models.inference.ai.azure.com",
    })(modelId)
}

async function testOne(provider, modelId) {
  const t0 = Date.now()
  try {
    const result = streamText({
      model: build(provider, modelId),
      tools,
      maxSteps: 3,
      system:
        "Khi user hỏi tính toán PHẢI gọi tool calculator. " +
        "Khi user hỏi giờ PHẢI gọi tool currentTime. Không tự tính.",
      messages: [{ role: "user", content: "Tính giúp: 137 * 29 + 8 = ?" }],
    })

    let toolCalled = false
    let toolName = null
    let text = ""
    let chunks = 0
    let firstChunkMs = null

    for await (const part of result.fullStream) {
      chunks++
      if (firstChunkMs === null) firstChunkMs = Date.now() - t0
      if (part.type === "tool-call") {
        toolCalled = true
        toolName = part.toolName
      } else if (part.type === "text-delta") {
        text += part.textDelta
      } else if (part.type === "error") {
        throw part.error
      }
    }
    return {
      ok: true,
      toolCalled,
      toolName,
      streaming: chunks > 3,
      chunks,
      ttfbMs: firstChunkMs,
      totalMs: Date.now() - t0,
      textPreview: text.slice(0, 80).replace(/\s+/g, " "),
    }
  } catch (e) {
    return { ok: false, error: (e?.message || String(e)).slice(0, 240), totalMs: Date.now() - t0 }
  }
}

const results = []
for (const [provider, info] of Object.entries(PROVIDERS)) {
  for (const m of info.models) {
    process.stdout.write(`Testing ${provider}/${m} ... `)
    const r = await testOne(provider, m)
    const status = r.ok
      ? r.toolCalled
        ? `OK tool=${r.toolName} stream=${r.streaming ? "y" : "n"} chunks=${r.chunks} ttfb=${r.ttfbMs}ms total=${r.totalMs}ms`
        : `NO-TOOL stream=${r.streaming ? "y" : "n"} total=${r.totalMs}ms text="${r.textPreview}"`
      : `ERR ${r.error}`
    console.log(status)
    results.push({ provider, model: m, ...r })
    await new Promise((r) => setTimeout(r, 800))
  }
}

console.log("\n=== SUMMARY ===")
for (const r of results) {
  const tool = r.ok ? (r.toolCalled ? "OK " : "NO ") : "ERR"
  const stream = r.ok ? (r.streaming ? "y" : "n") : "-"
  console.log(`${tool} stream=${stream}  ${r.provider.padEnd(8)} ${r.model}`)
}
const broken = results.filter((r) => !r.ok)
const noTool = results.filter((r) => r.ok && !r.toolCalled)
console.log(`\n${results.length} tested · ${broken.length} broken · ${noTool.length} no tool-call`)
if (broken.length) {
  console.log("\nBROKEN:")
  for (const b of broken) console.log(`  ${b.provider}/${b.model}: ${b.error}`)
}
