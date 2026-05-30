import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { getProviderFallbackOrder, routeModel, type AutoRouteProfile, DEFAULT_AUTO_ROUTE_PROFILE } from "@/lib/router"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import type { UserKeys } from "@/lib/user-keys"

const github = createOpenAI({
  apiKey: process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN || "",
  baseURL: "https://models.github.ai/inference",
})

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "" })
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY || "" })
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
})
const cerebras = createOpenAI({
  apiKey: process.env.CEREBRAS_API_KEY || "",
  baseURL: "https://api.cerebras.ai/v1",
})
const mistral = createOpenAI({
  apiKey: process.env.MISTRAL_API_KEY || "",
  baseURL: "https://api.mistral.ai/v1",
})

type ResolveTargetInput = {
  messages: any[]
  provider?: ProviderKey
  model?: string
  auto?: boolean
  autoProfile?: AutoRouteProfile
  userKeys?: UserKeys
}

export type ResolveTargetResult = {
  provider: ProviderKey
  model: string
  profile: AutoRouteProfile
  autoRoute?: ReturnType<typeof routeModel>
  fallback?: {
    fromProvider: ProviderKey
    toProvider: ProviderKey
    reason: string
  }
}

export function providerForModel(modelId: string): ProviderKey | null {
  for (const provider of Object.keys(PROVIDERS) as ProviderKey[]) {
    if ((PROVIDERS[provider].models as readonly string[]).includes(modelId)) return provider
  }
  return null
}

function getUserApiKey(provider: ProviderKey, userKeys?: UserKeys): string {
  if (!userKeys) return ""
  switch (provider) {
    case "google":
      return (userKeys.gemini ?? "").trim()
    case "groq":
      return (userKeys.groq ?? "").trim()
    case "github":
      return (userKeys.github ?? "").trim()
    case "openrouter":
      return (userKeys.openrouter ?? "").trim()
    default:
      return ""
  }
}

export function hasApiKey(provider: ProviderKey, userKeys?: UserKeys): boolean {
  const userKey = getUserApiKey(provider, userKeys)
  if (userKey) return true
  if (provider === "google") return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY)
  if (provider === "github") return Boolean(process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN)
  if (provider === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY)
  if (provider === "cerebras") return Boolean(process.env.CEREBRAS_API_KEY)
  if (provider === "mistral") return Boolean(process.env.MISTRAL_API_KEY)
  if (provider === "ollama") return true
  return false
}

function hasModel(provider: ProviderKey, model: string): boolean {
  return (PROVIDERS[provider].models as readonly string[]).includes(model)
}

function providerCandidates(profile: AutoRouteProfile, preferred?: ProviderKey, resolvedProvider?: ProviderKey): ProviderKey[] {
  const result: ProviderKey[] = []
  const add = (provider?: string | null) => {
    if (!provider) return
    if (!result.includes(provider as ProviderKey)) result.push(provider as ProviderKey)
  }
  add(resolvedProvider)
  add(preferred)
  for (const provider of getProviderFallbackOrder(profile)) add(provider)
  return result
}

export function resolveProviderAndModel(input: ResolveTargetInput): ResolveTargetResult {
  const profile = input.autoProfile ?? DEFAULT_AUTO_ROUTE_PROFILE
  const autoRequested = input.model === "auto" || input.auto === true || !input.model
  const autoRoute = autoRequested ? routeModel(input.messages, { profile }) : undefined
  const preferredProvider = input.provider ?? "google"
  const requestedModel = autoRoute?.modelId ?? input.model ?? PROVIDERS[preferredProvider].default
  const inferredProvider = providerForModel(requestedModel)
  const selectedProvider = inferredProvider ?? preferredProvider
  const selectedModel = inferredProvider ? requestedModel : requestedModel

  const candidates = providerCandidates(profile, preferredProvider, selectedProvider)
  const selectedProviderReady = hasApiKey(selectedProvider, input.userKeys) && (hasModel(selectedProvider, selectedModel) || inferredProvider !== null)
  if (selectedProviderReady) {
    return {
      provider: selectedProvider,
      model: selectedModel,
      profile,
      autoRoute,
    }
  }

  for (const candidate of candidates) {
    if (!hasApiKey(candidate, input.userKeys)) continue
    const candidateModel =
      (autoRoute && providerForModel(autoRoute.modelId) === candidate && autoRoute.modelId) ||
      (inferredProvider === candidate && requestedModel) ||
      PROVIDERS[candidate].default
    return {
      provider: candidate,
      model: candidateModel,
      profile,
      autoRoute,
      fallback: {
        fromProvider: selectedProvider,
        toProvider: candidate,
        reason: "Provider gốc thiếu API key hoặc model không khả dụng.",
      },
    }
  }

  return {
    provider: selectedProvider,
    model: selectedModel,
    profile,
    autoRoute,
  }
}

function ollamaBaseUrl(userKeys?: UserKeys): string {
  const maybe = (userKeys as any)?.ollamaBaseUrl
  if (typeof maybe === "string" && maybe.trim()) return maybe.trim()
  return process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1"
}

export function getModel(provider: ProviderKey, modelId: string, userKeys?: UserKeys) {
  const userKey = getUserApiKey(provider, userKeys)
  if (provider === "google") {
    const client = userKey ? createGoogleGenerativeAI({ apiKey: userKey }) : google
    return client(modelId)
  }
  if (provider === "groq") {
    const client = userKey ? createGroq({ apiKey: userKey }) : groq
    return client(modelId)
  }
  if (provider === "openrouter") {
    const client = userKey ? createOpenAI({ apiKey: userKey, baseURL: "https://openrouter.ai/api/v1" }) : openrouter
    return client(modelId)
  }
  if (provider === "github") {
    const client = userKey
      ? createOpenAI({ apiKey: userKey, baseURL: "https://models.github.ai/inference" })
      : github
    return client(modelId)
  }
  if (provider === "cerebras") return cerebras(modelId)
  if (provider === "mistral") return mistral(modelId)
  const ollama = createOpenAI({ apiKey: "ollama", baseURL: ollamaBaseUrl(userKeys) })
  return ollama(modelId)
}

export function getCompactionModel(userKeys?: UserKeys) {
  if (hasApiKey("google", userKeys)) {
    return getModel("google", "gemini-2.5-flash-lite", userKeys)
  }
  const fallbackProviders = getProviderFallbackOrder(DEFAULT_AUTO_ROUTE_PROFILE)
  for (const providerName of fallbackProviders) {
    const provider = providerName as ProviderKey
    if (!hasApiKey(provider, userKeys)) continue
    return getModel(provider, PROVIDERS[provider].default, userKeys)
  }
  return getModel("google", "gemini-2.5-flash-lite", userKeys)
}
