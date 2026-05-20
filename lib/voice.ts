export const VOICE_MODE_ON_KEY = "tans:voice-mode:on"
export const VOICE_MODE_LANG_KEY = "tans:voice-mode:lang"
export const DEFAULT_VOICE_LANG = "vi-VN"

export type VoiceRecognitionStatus = "idle" | "listening" | "error"

type SpeechRecognitionEventLike = Event & {
  resultIndex: number
  results: SpeechRecognitionResultList
}

type SpeechRecognitionErrorEventLike = Event & {
  error?: string
  message?: string
}

type SpeechRecognitionLike = EventTarget & {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: ((event: Event) => void) | null
  onend: ((event: Event) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported() {
  return !!getSpeechRecognitionConstructor()
}

export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
}

export class ContinuousSpeechRecognition {
  private recognition: SpeechRecognitionLike | null = null
  private active = false
  private restartTimer: number | null = null
  private transcript = ""

  constructor(
    private options: {
      lang?: string
      onTranscript?: (text: string) => void
      onStatus?: (status: VoiceRecognitionStatus) => void
      onError?: (message: string) => void
    } = {}
  ) {}

  setLang(lang: string) {
    this.options.lang = lang
    if (this.recognition) this.recognition.lang = lang
  }

  start() {
    const Recognition = getSpeechRecognitionConstructor()
    if (!Recognition) {
      this.options.onStatus?.("error")
      this.options.onError?.("Trình duyệt chưa hỗ trợ SpeechRecognition.")
      return false
    }

    this.active = true
    if (!this.recognition) this.recognition = this.createRecognition(Recognition)

    try {
      this.recognition.start()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể mở micro."
      if (!message.toLowerCase().includes("already")) {
        this.options.onStatus?.("error")
        this.options.onError?.(message)
      }
      return false
    }
  }

  stop() {
    this.active = false
    if (this.restartTimer) window.clearTimeout(this.restartTimer)
    this.restartTimer = null
    try {
      this.recognition?.stop()
    } catch {}
    this.options.onStatus?.("idle")
  }

  restart() {
    const shouldRestart = this.active
    this.active = false
    if (this.restartTimer) window.clearTimeout(this.restartTimer)
    this.restartTimer = null
    this.transcript = ""
    this.options.onTranscript?.("")
    try {
      this.recognition?.abort()
    } catch {}
    this.recognition = null
    if (shouldRestart) {
      this.restartTimer = window.setTimeout(() => {
        this.restartTimer = null
        this.start()
      }, 150)
    }
  }

  destroy() {
    this.stop()
    try {
      this.recognition?.abort()
    } catch {}
    this.recognition = null
  }

  private createRecognition(Recognition: SpeechRecognitionConstructor) {
    const recognition = new Recognition()
    recognition.lang = this.options.lang ?? DEFAULT_VOICE_LANG
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => this.options.onStatus?.("listening")
    recognition.onend = () => {
      this.options.onStatus?.("idle")
      if (!this.active || this.restartTimer) return
      this.restartTimer = window.setTimeout(() => {
        this.restartTimer = null
        this.start()
      }, 300)
    }
    recognition.onerror = (event) => {
      const message = event.message || event.error || "Lỗi nhận giọng nói."
      if (event.error !== "no-speech") this.options.onError?.(message)
      this.options.onStatus?.(this.active ? "listening" : "error")
    }
    recognition.onresult = (event) => {
      let next = ""
      for (let i = 0; i < event.results.length; i += 1) {
        next += event.results[i]?.[0]?.transcript ?? ""
      }
      this.transcript = next.trimStart()
      this.options.onTranscript?.(this.transcript)
    }

    return recognition
  }
}

function getVoices() {
  if (!isSpeechSynthesisSupported()) return Promise.resolve<SpeechSynthesisVoice[]>([])
  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) return Promise.resolve(voices)

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const timeout = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 600)
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout)
      resolve(window.speechSynthesis.getVoices())
    }
  })
}

export async function findVoice(lang = DEFAULT_VOICE_LANG) {
  const voices = await getVoices()
  return (
    voices.find((voice) => voice.lang === lang) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) ??
    null
  )
}

export async function speakText(
  text: string,
  options: {
    lang?: string
    rate?: number
    onStart?: () => void
    onEnd?: () => void
    onError?: () => void
  } = {}
) {
  const content = text.trim()
  if (!content || !isSpeechSynthesisSupported()) return false

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(content)
  utterance.lang = options.lang ?? DEFAULT_VOICE_LANG
  utterance.rate = options.rate ?? 1
  const voice = await findVoice(utterance.lang)
  if (voice) utterance.voice = voice

  utterance.onstart = () => options.onStart?.()
  utterance.onend = () => options.onEnd?.()
  utterance.onerror = () => {
    options.onError?.()
    options.onEnd?.()
  }
  window.speechSynthesis.speak(utterance)
  return true
}

export function cancelSpeech() {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel()
}
