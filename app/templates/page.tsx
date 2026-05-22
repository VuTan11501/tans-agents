"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Plus, Search, X } from "lucide-react"
import { TemplateCard } from "@/components/template-card"
import { TemplateFillDialog } from "@/components/template-fill-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  BUILTIN_PROMPT_TEMPLATES,
  PROMPT_TEMPLATE_CATEGORIES,
  createCustomPromptTemplate,
  extractTemplateVariables,
  getCustomPromptTemplates,
  saveCustomPromptTemplates,
  type PromptTemplate,
  type PromptTemplateCategory,
} from "@/lib/prompt-templates"
import { cn } from "@/lib/utils"

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (template: PromptTemplate) => void
}) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<PromptTemplateCategory>("other")
  const [body, setBody] = useState("")
  const [icon, setIcon] = useState("✨")

  useEffect(() => {
    if (!open) {
      setTitle("")
      setCategory("other")
      setBody("")
      setIcon("✨")
    }
  }, [open])

  const variables = useMemo(() => extractTemplateVariables(body), [body])
  const canSave = title.trim().length > 0 && body.trim().length > 0

  function handleCreate() {
    if (!canSave) return
    onCreate(createCustomPromptTemplate({ title, category, body, icon }))
    onOpenChange(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold">Tạo template mới</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Dùng cú pháp {"{{name}}"}, {"{{topic}}"} để tạo biến tự động.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Đóng">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="grid gap-4 sm:grid-cols-[88px_1fr]">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Icon</span>
              <Input value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={4} placeholder="✨" />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Tiêu đề</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Viết mô tả sản phẩm" />
            </label>
          </div>

          <label className="mt-4 block space-y-1.5">
            <span className="text-sm font-medium">Danh mục</span>
            <Select value={category} onValueChange={(value) => setCategory(value as PromptTemplateCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn danh mục" />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_TEMPLATE_CATEGORIES.filter((item) => item.value !== "all").map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="mt-4 block space-y-1.5">
            <span className="text-sm font-medium">Nội dung prompt</span>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Viết prompt... Ví dụ: Tạo dàn ý cho {{topic}} theo phong cách {{tone}}."
              className="min-h-44 font-mono text-sm"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {variables.length ? (
              variables.map((variable) => (
                <Badge key={variable} variant="outline" className="font-mono text-[10px]">
                  {`{{${variable}}}`}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Chưa phát hiện biến nào.</p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="outline">
                Huỷ
              </Button>
            </DialogPrimitive.Close>
            <Button type="button" onClick={handleCreate} disabled={!canSave} className="gap-2">
              <Plus className="h-4 w-4" /> Lưu template
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default function TemplatesPage() {
  const [customTemplates, setCustomTemplates] = useState<PromptTemplate[]>([])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<PromptTemplateCategory | "all">("all")
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null)
  const [fillOpen, setFillOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    setCustomTemplates(getCustomPromptTemplates())
  }, [])

  const templates = useMemo(() => [...BUILTIN_PROMPT_TEMPLATES, ...customTemplates], [customTemplates])

  const filteredTemplates = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return templates.filter((template) => {
      const matchesCategory = category === "all" || template.category === category
      const matchesSearch =
        !keyword ||
        template.title.toLowerCase().includes(keyword) ||
        template.body.toLowerCase().includes(keyword) ||
        template.variables.some((variable) => variable.toLowerCase().includes(keyword))
      return matchesCategory && matchesSearch
    })
  }, [category, search, templates])

  function handleUse(template: PromptTemplate) {
    setSelectedTemplate(template)
    setFillOpen(true)
  }

  async function handleCopy(template: PromptTemplate) {
    const ok = await copyText(template.body)
    setStatus(ok ? `Đã sao chép: ${template.title}` : "Không thể sao chép tự động.")
  }

  function handleCreate(template: PromptTemplate) {
    const next = [...customTemplates, template]
    const ok = saveCustomPromptTemplates(next)
    if (ok) {
      setCustomTemplates(next)
      setStatus(`Đã tạo template: ${template.title}`)
    } else {
      setStatus("Không thể lưu template vào localStorage.")
    }
  }

  function handleDelete(template: PromptTemplate) {
    const okToDelete = window.confirm(`Xoá template "${template.title}"?`)
    if (!okToDelete) return
    const next = customTemplates.filter((item) => item.id !== template.id)
    const ok = saveCustomPromptTemplates(next)
    if (ok) {
      setCustomTemplates(next)
      setStatus(`Đã xoá template: ${template.title}`)
    } else {
      setStatus("Không thể xoá template khỏi localStorage.")
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← Quay lại Chat
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Thư viện prompt template</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Duyệt template có sẵn, điền biến {"{{name}}"}, xem trước rồi sao chép hoặc mở trong Chat.
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Tạo template mới
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Tìm template</CardTitle>
          <CardDescription>{templates.length} template · gồm built-in và template tự tạo trên thiết bị này.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tiêu đề, nội dung hoặc biến..."
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={(value) => setCategory(value as PromptTemplateCategory | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Danh mục" />
            </SelectTrigger>
            <SelectContent>
              {PROMPT_TEMPLATE_CATEGORIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status && <p className="text-sm text-muted-foreground md:col-span-2">{status}</p>}
        </CardContent>
      </Card>

      {filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Không tìm thấy template phù hợp. Hãy đổi từ khoá hoặc tạo template mới.
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={handleUse}
              onCopy={handleCopy}
              onDelete={template.isBuiltin ? undefined : handleDelete}
            />
          ))}
        </section>
      )}

      <TemplateFillDialog template={selectedTemplate} open={fillOpen} onOpenChange={setFillOpen} />
      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
    </main>
  )
}
