"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Play, RotateCw, Terminal } from "lucide-react"
import { JS_SANDBOX_WORKER_SOURCE } from "@/lib/sandbox-worker"

type JsRunnerProps = {
  code: string
  autoRun?: boolean
}

type RunStatus = "idle" | "running" | "done" | "error"

const JS_TIMEOUT_MS = 5000

export function JsRunner({ code, autoRun = true }: JsRunnerProps) {
  const [status, setStatus] = useState<RunStatus>("idle")
  const [stdout, setStdout] = useState("")
  const [stderr, setStderr] = useState("")
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  const runCode = useCallback(() => {
    stopWorker()
    setStatus("running")
    setStdout("")
    setStderr("")
    setExecutionTimeMs(null)

    const start = performance.now()
    const workerUrl = URL.createObjectURL(new Blob([JS_SANDBOX_WORKER_SOURCE], { type: "text/javascript" }))
    const worker = new Worker(workerUrl)
    workerRef.current = worker

    let nextStdout = ""
    let nextStderr = ""
    let finished = false

    const cleanup = () => {
      URL.revokeObjectURL(workerUrl)
      if (workerRef.current === worker) workerRef.current = null
      worker.terminate()
    }

    const timeoutId = window.setTimeout(() => {
      if (finished) return
      finished = true
      nextStderr += "Quá thời gian 5 giây. Worker đã bị dừng.\n"
      setStderr(nextStderr)
      setExecutionTimeMs(performance.now() - start)
      setStatus("error")
      cleanup()
    }, JS_TIMEOUT_MS)

    worker.onmessage = (event: MessageEvent<{ type: string; text?: string }>) => {
      if (finished) return
      const { type, text } = event.data
      if (type === "stdout" && text !== undefined) {
        nextStdout += `${text}\n`
        setStdout(nextStdout)
      } else if (type === "stderr" && text !== undefined) {
        nextStderr += `${text}\n`
        setStderr(nextStderr)
      } else if (type === "done" || type === "error") {
        finished = true
        window.clearTimeout(timeoutId)
        setExecutionTimeMs(performance.now() - start)
        setStatus(type === "done" ? "done" : "error")
        cleanup()
      }
    }

    worker.onerror = (event) => {
      if (finished) return
      finished = true
      window.clearTimeout(timeoutId)
      nextStderr += event.message || "Không thể chạy JavaScript."
      setStderr(nextStderr)
      setExecutionTimeMs(performance.now() - start)
      setStatus("error")
      cleanup()
    }

    worker.postMessage({ code })

    return () => {
      if (!finished) window.clearTimeout(timeoutId)
      cleanup()
    }
  }, [code, stopWorker])

  useEffect(() => {
    if (!autoRun) return
    return runCode()
  }, [autoRun, runCode])

  useEffect(() => stopWorker, [stopWorker])

  const isRunning = status === "running"

  return (
    <div className="w-full rounded-xl border border-border/70 bg-card/80 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Terminal className="h-4 w-4 text-yellow-500" />
          <span>🟨 JavaScript</span>
        </div>
        <button
          type="button"
          onClick={runCode}
          disabled={isRunning}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          Chạy lại
        </button>
      </div>

      <div className="space-y-3 p-4 text-sm">
        {isRunning && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-muted-foreground">
            <Play className="h-4 w-4" />
            <span>Đang chạy mã JavaScript trong worker...</span>
          </div>
        )}

        <pre className="min-h-16 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs text-foreground">
          {stdout || (isRunning ? "" : "(không có console.log/output)")}
        </pre>

        {stderr && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs text-red-500">
            {stderr}
          </pre>
        )}

        {executionTimeMs !== null && (
          <div className="text-xs text-muted-foreground">Thời gian chạy: {executionTimeMs.toFixed(0)} ms</div>
        )}
      </div>
    </div>
  )
}
