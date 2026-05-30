import { z } from "zod"
import type { ProviderKey } from "@/lib/providers"
import type { AutoRouteProfile } from "@/lib/router"
import type { UserKeys } from "@/lib/user-keys"

const providerSchema = z.custom<ProviderKey>((value) => typeof value === "string")
const autoProfileSchema = z.enum(["speed", "balanced", "quality"])

const userKeysSchema = z
  .object({
    groq: z.string().optional(),
    gemini: z.string().optional(),
    github: z.string().optional(),
    openrouter: z.string().optional(),
    brave: z.string().optional(),
  })
  .partial()

export const chatRequestSchema = z.object({
  messages: z.array(z.any()).default([]),
  provider: providerSchema.optional(),
  model: z.string().optional(),
  enabledTools: z.array(z.string()).optional(),
  userKeys: userKeysSchema.optional(),
  auto: z.boolean().optional(),
  autoProfile: autoProfileSchema.optional(),
  personaSystemPrompt: z.string().optional(),
  workspacePackId: z.string().optional(),
  smartRetry: z.boolean().optional(),
  retryAttempt: z.number().int().min(0).max(5).optional(),
})

export type ParsedChatRequest = Omit<z.infer<typeof chatRequestSchema>, "provider" | "userKeys" | "autoProfile"> & {
  provider?: ProviderKey
  userKeys?: UserKeys
  autoProfile?: AutoRouteProfile
}

export function parseChatRequest(raw: unknown): ParsedChatRequest {
  const parsed = chatRequestSchema.parse(raw)
  return parsed as ParsedChatRequest
}
