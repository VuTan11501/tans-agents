"use client"

import { useEffect, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react"
import { ModelPicker } from "@/components/model-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import { cn } from "@/lib/utils"
import {
  deleteWorkflow,
  listWorkflows,
  runWorkflow,
  saveWorkflow,
  type Workflow,
  type WorkflowStep,
} from "@/lib/workflows"

const DEFAULT_PROVIDER: ProviderKey = "google"
const DEFAULT_MODEL = PROVIDERS[DEFAULT_PROVIDER].default

function newStep(index: number): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    name: `Bước ${index + 1}`,
    prompt: index === 0 ? "{{prev}}" : "Dựa trên kết quả trước:\n{{prev}}\n\nHãy tiếp tục xử lý.",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
  }
}

function newWorkflow(): Workflow {
  return {
    id: crypto.randomUUID(),
    name: "Workflow mới",
    steps: [newStep(0)],
    createdAt: Date.now(),
  }
}

function Modal({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-xl",
            className,
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Đóng">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [runTarget, setRunTarget] = useState<Workflow | null>(null)
  const [initialInput, setInitialInput] = useState("")
  const [outputs, setOutputs] = useState<Record<number, string>>({})
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState("")

  const refresh = () => setWorkflows(listWorkflows())

  useEffect(() => {
    refresh()
  }, [])

  function persist(next: Workflow) {
    setEditing(next)
    saveWorkflow(next)
    refresh()
  }

  function createWorkflow() {
    const wf = newWorkflow()
    saveWorkflow(wf)
    setEditing(wf)
    refresh()
  }

  function updateStep(index: number, patch: Partial<WorkflowStep>) {
    if (!editing) return
    const steps = editing.steps.map((step, i) => (i === index ? { ...step, ...patch } : step))
    persist({ ...editing, steps })
  }

  function moveStep(index: number, direction: -1 | 1) {
    if (!editing) return
    const target = index + direction
    if (target < 0 || target >= editing.steps.length) return
    const steps = [...editing.steps]
    ;[steps[index], steps[target]] = [steps[target], steps[index]]
    persist({ ...editing, steps })
  }

  async function executeWorkflow() {
    if (!runTarget || running) return
    setRunning(true)
    setRunError("")
    setOutputs({})

    try {
      for await (const chunk of runWorkflow(runTarget, initialInput, {
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
      })) {
        setOutputs((current) => ({ ...current, [chunk.stepIndex]: chunk.partial }))
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error))
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflow builder</h1>
          <p className="text-sm text-muted-foreground">Tạo chuỗi prompt, dùng {"{{prev}}"} để truyền kết quả bước trước.</p>
        </div>
        <Button onClick={createWorkflow} className="gap-2">
          <Plus className="h-4 w-4" /> Tạo workflow
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="space-y-3">
          {workflows.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chưa có workflow</CardTitle>
                <CardDescription>Bấm “Tạo workflow” để bắt đầu.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            workflows.map((wf) => (
              <Card key={wf.id} className={cn(editing?.id === wf.id && "border-primary")}>
                <CardHeader className="p-4">
                  <CardTitle className="text-base">{wf.name || "Chưa đặt tên"}</CardTitle>
                  <CardDescription>{wf.steps.length} bước</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2 p-4 pt-0">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(wf)}>Sửa</Button>
                  <Button variant="outline" size="sm" onClick={() => { setRunTarget(wf); setOutputs({}); setRunError("") }}>Chạy</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive"
                    onClick={() => { deleteWorkflow(wf.id); if (editing?.id === wf.id) setEditing(null); refresh() }}
                  >
                    Xóa
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <section>
          {!editing ? (
            <Card>
              <CardHeader>
                <CardTitle>Chọn workflow để chỉnh sửa</CardTitle>
                <CardDescription>Workflow được lưu tự động vào localStorage.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Editor</CardTitle>
                <CardDescription>Lưu tự động sau mỗi thay đổi.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Tên workflow</span>
                  <Input value={editing.name} onChange={(event) => persist({ ...editing, name: event.target.value })} />
                </label>

                <div className="space-y-3">
                  {editing.steps.map((step, index) => (
                    <Card key={step.id} className="border-dashed">
                      <CardHeader className="p-4 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-sm">Bước {index + 1}</CardTitle>
                          <Input
                            value={step.name}
                            onChange={(event) => updateStep(index, { name: event.target.value })}
                            className="h-8 max-w-xs"
                          />
                          <div className="ml-auto flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => moveStep(index, 1)} disabled={index === editing.steps.length - 1}>
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => persist({ ...editing, steps: editing.steps.filter((_, i) => i !== index) })}
                              disabled={editing.steps.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 p-4 pt-0">
                        <Textarea
                          value={step.prompt}
                          onChange={(event) => updateStep(index, { prompt: event.target.value })}
                          className="min-h-32 font-mono text-xs"
                          placeholder="Prompt... dùng {{prev}} để lấy output bước trước"
                        />
                        <ModelPicker
                          provider={(step.provider as ProviderKey | undefined) ?? DEFAULT_PROVIDER}
                          model={step.model || DEFAULT_MODEL}
                          onChange={(provider, model) => updateStep(index, { provider, model })}
                          align="start"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => persist({ ...editing, steps: [...editing.steps, newStep(editing.steps.length)] })}>
                    Thêm bước
                  </Button>
                  <Button onClick={() => { setRunTarget(editing); setOutputs({}); setRunError("") }}>Chạy workflow</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <Modal open={Boolean(runTarget)} onOpenChange={(open) => !open && setRunTarget(null)} title={`Chạy: ${runTarget?.name ?? "workflow"}`}>
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Input ban đầu</span>
            <Textarea value={initialInput} onChange={(event) => setInitialInput(event.target.value)} className="min-h-28" />
          </label>
          <Button onClick={executeWorkflow} disabled={running || !runTarget?.steps.length}>
            {running ? "Đang chạy..." : "Bắt đầu"}
          </Button>
          {runError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{runError}</p>}
          <div className="space-y-3">
            {runTarget?.steps.map((step, index) => (
              <Card key={step.id}>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">{index + 1}. {step.name}</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap p-4 pt-0 text-sm">
                  {outputs[index] || <span className="text-muted-foreground">Chưa có output</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Modal>
    </main>
  )
}
