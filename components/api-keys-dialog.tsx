"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Eye, EyeOff, KeyRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DEFAULT_OLLAMA_BASE_URL, type UserKeyProvider, type UserKeys } from "@/lib/user-keys"

const PROVIDERS: Array<{ key: UserKeyProvider; label: string; href: string }> = [
  { key: "groq", label: "Groq", href: "https://groq.com/keys" },
  { key: "gemini", label: "Gemini", href: "https://ai.dev" },
  { key: "github", label: "GitHub Models", href: "https://github.com/settings/personal-access-tokens" },
  { key: "openrouter", label: "OpenRouter (50+ free)", href: "https://openrouter.ai/keys" },
  { key: "cerebras", label: "Cerebras (>2000 t/s)", href: "https://cloud.cerebras.ai/platform/api-keys" },
  { key: "mistral", label: "Mistral", href: "https://console.mistral.ai/api-keys" },
  { key: "brave", label: "Brave Search", href: "https://brave.com/search/api" },
]

interface ApiKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keys: UserKeys
  setKey: (provider: UserKeyProvider, value: string) => void
  clearAll: () => void
}

export function ApiKeysDialog({ open, onOpenChange, keys, setKey, clearAll }: ApiKeysDialogProps) {
  const [draft, setDraft] = useState<UserKeys>(keys)
  const [visible, setVisible] = useState<Partial<Record<UserKeyProvider, boolean>>>({
    groq: false,
    gemini: false,
    github: false,
    openrouter: false,
    cerebras: false,
    mistral: false,
    brave: false,
  })

  useEffect(() => {
    if (open) setDraft(keys)
  }, [keys, open])

  function handleSave() {
    for (const provider of PROVIDERS) {
      setKey(provider.key, draft[provider.key] ?? "")
    }
    setKey("ollamaBaseUrl", draft.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL)
    onOpenChange(false)
  }

  function handleClearAll() {
    setDraft({ ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL })
    clearAll()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[94vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
          <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="h-4 w-4" /> API keys cá nhân
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Keys chỉ lưu trong localStorage của trình duyệt này và được gửi kèm request chat khi provider tương ứng được chọn.
          </Dialog.Description>

          <div className="mt-4 space-y-3 overflow-y-auto pr-1">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Ollama base URL</span>
              <Input
                type="url"
                value={draft.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL}
                onChange={(event) => setDraft((current) => ({ ...current, ollamaBaseUrl: event.target.value }))}
                placeholder={DEFAULT_OLLAMA_BASE_URL}
              />
              <p className="text-xs text-muted-foreground">Dùng cho Ollama local, ví dụ http://localhost:11434.</p>
            </label>

            {PROVIDERS.map((provider) => {
              const isVisible = visible[provider.key]
              return (
                <label key={provider.key} className="block space-y-1.5">
                  <span className="text-sm font-medium">{provider.label}</span>
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Input
                        type={isVisible ? "text" : "password"}
                        value={draft[provider.key] ?? ""}
                        onChange={(event) => setDraft((current) => ({ ...current, [provider.key]: event.target.value }))}
                        placeholder={`Nhập ${provider.label} key`}
                        className="pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setVisible((current) => ({ ...current, [provider.key]: !current[provider.key] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={isVisible ? "Ẩn key" : "Hiện key"}
                      >
                        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button type="button" variant="outline" size="sm" asChild className="h-10 shrink-0">
                      <a href={provider.href} target="_blank" rel="noreferrer">
                        Lấy key
                      </a>
                    </Button>
                  </div>
                </label>
              )
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClearAll}>
              Xoá tất cả
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button type="button" size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>

          <Dialog.Close
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Đóng API keys"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
