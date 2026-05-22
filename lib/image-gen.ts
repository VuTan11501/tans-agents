export interface GenerateImageOptions {
  width?: number
  height?: number
  seed?: number
  nologo?: boolean
}

const POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt"
const DEFAULT_SIZE = 1024

export function parseImageCommand(text: string): string | null {
  const match = text.trim().match(/^\/(?:image|img)\s+([\s\S]+)$/i)
  const prompt = match?.[1]?.trim()
  return prompt ? prompt : null
}

export function generateImageUrl(prompt: string, opts: GenerateImageOptions = {}): string {
  const cleanPrompt = prompt.trim()
  const width = opts.width ?? DEFAULT_SIZE
  const height = opts.height ?? DEFAULT_SIZE
  const seed = opts.seed ?? Math.floor(Math.random() * 1_000_000_000)
  const nologo = opts.nologo ?? true
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    nologo: String(nologo),
    seed: String(seed),
  })

  return `${POLLINATIONS_BASE_URL}/${encodeURIComponent(cleanPrompt)}?${params.toString()}`
}
