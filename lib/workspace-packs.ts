import type { AutoRouteProfile } from "@/lib/router"
import type { PersonaId } from "@/lib/personas"

export type PromptPlaybookDefaults = {
  repo?: string
  ticket?: string
  goal?: string
  stack?: string
}

export interface WorkspacePack {
  id: string
  label: string
  description: string
  persona: PersonaId
  autoProfile: AutoRouteProfile
  enabledTools?: string[]
  memoryAbout?: string
  memoryFacts?: string[]
  promptDefaults?: PromptPlaybookDefaults
}

export const WORKSPACE_PACKS: WorkspacePack[] = [
  {
    id: "general",
    label: "General",
    description: "Mặc định linh hoạt cho đa số tác vụ.",
    persona: "default",
    autoProfile: "balanced",
    promptDefaults: {
      goal: "Hoàn thành task nhanh, đúng yêu cầu",
      stack: "Next.js + TypeScript",
    },
  },
  {
    id: "nextjs-feature",
    label: "Next.js Feature",
    description: "Tối ưu cho phát triển tính năng frontend/fullstack.",
    persona: "coder",
    autoProfile: "quality",
    enabledTools: ["webSearch", "fetchUrl", "runJs", "runSql", "githubQuery"],
    memoryAbout: "Ưu tiên câu trả lời thực dụng cho code production.",
    memoryFacts: [
      "Ưu tiên giữ backward compatibility.",
      "Mặc định viết TypeScript strict-safe.",
    ],
    promptDefaults: {
      goal: "Thiết kế + implement feature sạch, testable",
      stack: "Next.js App Router, React, TypeScript, Tailwind",
    },
  },
  {
    id: "debug-incident",
    label: "Debug Incident",
    description: "Tập trung điều tra lỗi, root cause và rollback-safe fix.",
    persona: "researcher",
    autoProfile: "speed",
    enabledTools: ["webSearch", "fetchUrl", "runJs", "runSql"],
    memoryFacts: [
      "Luôn ưu tiên tái hiện lỗi trước khi sửa.",
      "Không bỏ qua edge case và regression.",
    ],
    promptDefaults: {
      goal: "Xác định root cause và fix dứt điểm",
      stack: "Web app production",
    },
  },
]

export const DEFAULT_WORKSPACE_PACK_ID = "general"
const ACTIVE_WORKSPACE_PACK_KEY = "tans-agents:active-workspace-pack"

export function getWorkspacePack(id?: string | null): WorkspacePack {
  if (!id) return WORKSPACE_PACKS[0]
  return WORKSPACE_PACKS.find((pack) => pack.id === id) ?? WORKSPACE_PACKS[0]
}

export function getWorkspacePackById(id?: string | null): WorkspacePack | undefined {
  if (!id) return undefined
  return WORKSPACE_PACKS.find((pack) => pack.id === id)
}

export function readActiveWorkspacePackId(): string | undefined {
  if (typeof window === "undefined") return undefined
  const value = window.localStorage.getItem(ACTIVE_WORKSPACE_PACK_KEY)
  return value || undefined
}

export function writeActiveWorkspacePackId(id: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ACTIVE_WORKSPACE_PACK_KEY, id)
}
