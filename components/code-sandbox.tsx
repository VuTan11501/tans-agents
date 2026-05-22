"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildCodeSandboxHtml } from "@/lib/code-sandbox-html"
import { cn } from "@/lib/utils"

type SandboxLine = {
  type: "log" | "err"
  value: string
}

type CodeSandboxButtonProps = {
  language: string
  code: string
}

export function CodeSandboxButton({ language, code }: CodeSandboxButtonProps) {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [frameKey, setFrameKey] = useState(0)
  const [lines, setLines] = useState<SandboxLine[]>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const srcDoc = useMemo(() => (running ? buildCodeSandboxHtml(language, code) : ""), [code, language, running])
  const errors = lines.filter((line) => line.type === "err")
  const logs = lines.filter((line) => line.type !== "err")

  useEffect(() => {
    if (!open) return

    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data
      if (!data || (data.sb !== "log" && data.sb !== "err")) return
      setLines((current) => [...current, { type: data.sb, value: String(data.v ?? "") }])
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [open])

  function run() {
    setLines([])
    setOpen(true)
    setRunning(true)
    setFrameKey((key) => key + 1)
  }

  function stop() {
    setRunning(false)
  }

  function close() {
    setRunning(false)
    setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={run}
        className="h-auto gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        ▶ Chạy
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <Card className="w-full max-w-4xl overflow-hidden shadow-lg">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b p-4">
              <CardTitle className="text-base">Sandbox: {language || "code"}</CardTitle>
              <div className="flex items-center gap-2">
                {running ? (
                  <Button type="button" variant="secondary" size="sm" onClick={stop}>
                    🛑 Dừng
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={run}>
                    ▶ Chạy
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={close}>
                  Đóng
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2">
              <div className="min-h-[220px] overflow-hidden rounded-md border bg-white">
                {running && <iframe ref={iframeRef} key={frameKey} title="Code sandbox" sandbox="allow-scripts" srcDoc={srcDoc} className="h-[320px] w-full bg-white" />}
                {!running && <div className="p-4 text-sm text-muted-foreground">Sandbox đã dừng.</div>}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-sm font-medium">Output:</div>
                  <div className="max-h-[300px] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
                    {logs.length === 0 ? <div className="text-muted-foreground">Chưa có output.</div> : logs.map((line, index) => <div key={`log-${index}`}>{line.value}</div>)}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-sm font-medium text-destructive">Lỗi:</div>
                  <div className="max-h-[300px] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
                    {errors.length === 0 ? (
                      <div className="text-muted-foreground">Không có lỗi.</div>
                    ) : (
                      errors.map((line, index) => (
                        <div key={`err-${index}`} className={cn("text-destructive")}>
                          {line.value}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
