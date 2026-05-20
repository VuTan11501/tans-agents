// Smoke test: kiểm tra mỗi model có gọi được generateContent + tool call không.
// Run: node scripts/test-models-tools.mjs
import "dotenv/config"
import fs from "node:fs"
import path from "node:path"

// Minimal .env.local loader (dotenv/config above might miss .env.local)
const envFile = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1")
  }
}

import { generateText, tool } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"

const calculator = tool({
  description: "Evaluate a math expression like '12 * 34'.",
  parameters: z.object({ expression: z.string() }),
  execute: async ({ expression }) => ({ result: eval(expression) }),
})
const currentTime = tool({
  description: "Get current ISO time. Use when asked about time/date.",
  parameters: z.object({}),
  execute: async () => ({ now: new Date().toISOString() }),
})
const tools = { calculator, currentTime }

const MODELS = [
  ["google", "gemini-2.5-flash-lite"],
  ["google", "gemini-2.5-flash"],
  ["google", "gemini-2.5-pro"],
  ["google", "gemini-2.0-flash"],
  ["google", "gemini-2.0-flash-lite"],
  ["google", "gemini-flash-latest"],
  ["google", "gemini-flash-lite-latest"],
  ["google", "gemma-4-26b-a4b-it"],
  ["google", "gemma-4-31b-it"],
  ["groq", "llama-3.3-70b-versatile"],
  ["groq", "llama-3.1-8b-instant"],
  ["groq", "openai/gpt-oss-120b"],
  ["groq", "openai/gpt-oss-20b"],
  ["groq", "qwen/qwen3-32b"],
  ["groq", "meta-llama/llama-4-scout-17b-16e-instruct"],
  ["github", "gpt-4o-mini"],
  ["github", "gpt-4o"],
]

function getModel(provider, modelId) {
  if (provider === "google") return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId)
  if (provider === "groq") return createGroq({ apiKey: process.env.GROQ_API_KEY })(modelId)
  if (provider === "github") return createOpenAI({ apiKey: process.env.GITHUB_TOKEN, baseURL: "https://models.inference.ai.azure.com" })(modelId)
}

const results = []
for (const [provider, modelId] of MODELS) {
  const row = { provider, modelId, basic: "", toolCall: "" }
  // Basic
  try {
    const r = await generateText({
      model: getModel(provider, modelId),
      prompt: "Trả lời ngắn: 2+2=?",
      maxTokens: 50,
    })
    row.basic = r.text ? "OK: " + r.text.slice(0, 40).replace(/\n/g, " ") : "EMPTY"
  } catch (e) {
    row.basic = "FAIL: " + (e.message || String(e)).slice(0, 100)
  }
  // Tool call
  try {
    const r = await generateText({
      model: getModel(provider, modelId),
      tools,
      maxSteps: 3,
      prompt: "Tính 17 * 23 bằng tool calculator, rồi trả về kết quả.",
      maxTokens: 200,
    })
    const used = (r.toolCalls?.length ?? 0) + (r.steps?.flatMap((s) => s.toolCalls || []).length ?? 0)
    row.toolCall = used > 0 ? `OK (${used} call): ${r.text?.slice(0, 40)}` : `NO_TOOL: ${r.text?.slice(0, 40)}`
  } catch (e) {
    row.toolCall = "FAIL: " + (e.message || String(e)).slice(0, 100)
  }
  console.log(`[${provider}] ${modelId}`)
  console.log(`  basic: ${row.basic}`)
  console.log(`  tool : ${row.toolCall}`)
  results.push(row)
  await new Promise((r) => setTimeout(r, 500))
}

console.log("\n\n=== SUMMARY ===")
console.log("provider\tmodel\tbasic\ttool")
for (const r of results) {
  const b = r.basic.startsWith("OK") ? "✓" : "✗"
  const t = r.toolCall.startsWith("OK") ? "✓" : r.toolCall.startsWith("NO_TOOL") ? "—" : "✗"
  console.log(`${r.provider}\t${r.modelId}\t${b}\t${t}`)
}
