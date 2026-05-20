"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Play, RotateCw, Terminal } from "lucide-react"

const PYODIDE_SCRIPT_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"
const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"

type Pyodide = {
  runPythonAsync: (code: string) => Promise<unknown>
  setStdout: (options: { batched: (text: string) => void }) => void
  setStderr: (options: { batched: (text: string) => void }) => void
}

declare global {
  interface Window {
    loadPyodide?: (options?: { indexURL?: string }) => Promise<Pyodide>
  }
}

type PythonRunnerProps = {
  code: string
  autoRun?: boolean
}

type RunStatus = "idle" | "loading" | "running" | "done" | "error"

let pyodideInstance: Pyodide | null = null
let pyodidePromise: Promise<Pyodide> | null = null
let runQueue: Promise<void> = Promise.resolve()

export function PythonRunner({ code, autoRun = true }: PythonRunnerProps) {
  const [status, setStatus] = useState<RunStatus>("idle")
  const [stdout, setStdoutText] = useState("")
  const [stderr, setStderrText] = useState("")
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null)

  const runCode = useCallback(() => {
    let cancelled = false

    setStatus(pyodideInstance ? "running" : "loading")
    setStdoutText("")
    setStderrText("")
    setExecutionTimeMs(null)

    const queuedRun = runQueue.catch(() => undefined).then(async () => {
      const start = performance.now()
      let nextStdout = ""
      let nextStderr = ""

      try {
        const pyodide = await loadPyodideSingleton()
        if (!cancelled) setStatus("running")

        pyodide.setStdout({
          batched: (text) => {
            nextStdout += text + "\n"
            if (!cancelled) setStdoutText(nextStdout)
          },
        })
        pyodide.setStderr({
          batched: (text) => {
            nextStderr += text + "\n"
            if (!cancelled) setStderrText(nextStderr)
          },
        })

        const result = await pyodide.runPythonAsync(code)
        if (result !== undefined && result !== null) {
          nextStdout += String(result) + "\n"
        }

        if (!cancelled) {
          setStdoutText(nextStdout)
          setStderrText(nextStderr)
          setExecutionTimeMs(performance.now() - start)
          setStatus("done")
        }
      } catch (error) {
        nextStderr += error instanceof Error ? error.message : "Không thể chạy mã Python."
        if (!cancelled) {
          setStdoutText(nextStdout)
          setStderrText(nextStderr)
          setExecutionTimeMs(performance.now() - start)
          setStatus("error")
        }
      }
    })

    runQueue = queuedRun

    return () => {
      cancelled = true
    }
  }, [code])

  useEffect(() => {
    if (!autoRun) return
    return runCode()
  }, [autoRun, runCode])

  const isLoading = status === "loading"
  const isRunning = status === "running"
  const isBusy = isLoading || isRunning

  return (
    <div className="w-full rounded-xl border border-border/70 bg-card/80 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Terminal className="h-4 w-4 text-emerald-500" />
          <span>🐍 Python</span>
        </div>
        <button
          type="button"
          onClick={runCode}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          Chạy lại
        </button>
      </div>

      <div className="space-y-3 p-4 text-sm">
        {isLoading && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Đang khởi tạo Python...</span>
          </div>
        )}

        {isRunning && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-muted-foreground">
            <Play className="h-4 w-4" />
            <span>Đang chạy mã Python...</span>
          </div>
        )}

        <pre className="min-h-16 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs text-foreground">
          {stdout || (isBusy ? "" : "(không có stdout)")}
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

function loadPyodideSingleton(): Promise<Pyodide> {
  if (pyodideInstance) return Promise.resolve(pyodideInstance)
  if (!pyodidePromise) {
    pyodidePromise = loadPyodideScript()
      .then(() => {
        if (!window.loadPyodide) throw new Error("Không thể tải Pyodide.")
        return window.loadPyodide({ indexURL: PYODIDE_INDEX_URL })
      })
      .then((pyodide) => {
        pyodideInstance = pyodide
        return pyodide
      })
      .catch((error) => {
        pyodidePromise = null
        throw error
      })
  }
  return pyodidePromise
}

function loadPyodideScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Pyodide chỉ chạy trong trình duyệt."))
  if (window.loadPyodide) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${PYODIDE_SCRIPT_URL}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Không thể tải pyodide.js.")), { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = PYODIDE_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Không thể tải pyodide.js."))
    document.head.appendChild(script)
  })
}
