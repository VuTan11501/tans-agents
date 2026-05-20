import { tool } from "ai"
import { z } from "zod"

export const currentTime = tool({
  description: "Get the current date and time in ISO format. Use when user asks about time/date.",
  parameters: z.object({}),
  execute: async () => ({ now: new Date().toISOString() }),
})

export const calculator = tool({
  description: "Evaluate a simple math expression. Only digits and + - * / ( ) . are allowed.",
  parameters: z.object({ expression: z.string().describe("e.g. '12 * 34 + 5'") }),
  execute: async ({ expression }) => {
    if (!/^[\d+\-*/().\s]+$/.test(expression)) return { error: "invalid characters" }
    try {
      const result = safeEval(expression)
      return { result }
    } catch (e: any) {
      return { error: e?.message || "eval error" }
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

export const webSearch = tool({
  description: "Search the web via DuckDuckGo. Use for current news, facts, anything beyond training cutoff.",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      const r = await fetch(url)
      const data = await r.json()
      const topics = (data.RelatedTopics || [])
        .filter((t: any) => t.Text)
        .slice(0, 5)
        .map((t: any, i: number) => `[${i + 1}] ${t.Text} — ${t.FirstURL || ""}`)
      const abstract = data.AbstractText || ""
      return { abstract, related: topics.length ? topics.join("\n") : "no results" }
    } catch (e: any) {
      return { error: e?.message || "search failed" }
    }
  },
})

export const agentTools = { currentTime, calculator, webSearch }
