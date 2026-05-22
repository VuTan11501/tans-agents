export type VoicePrefs = {
  voiceName?: string
  rate: number
  pitch: number
  autoSpeak: boolean
}

export type SpeakOptions = {
  voice?: string
  rate?: number
  pitch?: number
  lang?: string
}

export type SpeakController = {
  stop: () => void
  pause: () => void
  resume: () => void
  isSpeaking: () => boolean
}

export const VOICE_PREFS_KEY = "tans-agents:voice-prefs-v1"

const DEFAULT_PREFS: VoicePrefs = {
  rate: 1,
  pitch: 1,
  autoSpeak: false,
}

function hasWindow() {
  return typeof window !== "undefined"
}

function getSynth() {
  if (!hasWindow() || !("speechSynthesis" in window)) return null
  return window.speechSynthesis
}

function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function getPrefs(): VoicePrefs {
  if (!hasWindow()) return { ...DEFAULT_PREFS }

  try {
    const raw = window.localStorage.getItem(VOICE_PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<VoicePrefs>
    return {
      voiceName: typeof parsed.voiceName === "string" ? parsed.voiceName : undefined,
      rate: clamp(parsed.rate, 0.5, 2, DEFAULT_PREFS.rate),
      pitch: clamp(parsed.pitch, 0.5, 2, DEFAULT_PREFS.pitch),
      autoSpeak: Boolean(parsed.autoSpeak),
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function setPrefs(partial: Partial<VoicePrefs>): VoicePrefs {
  const next: VoicePrefs = {
    ...getPrefs(),
    ...partial,
    rate: clamp(partial.rate ?? getPrefs().rate, 0.5, 2, DEFAULT_PREFS.rate),
    pitch: clamp(partial.pitch ?? getPrefs().pitch, 0.5, 2, DEFAULT_PREFS.pitch),
    autoSpeak: partial.autoSpeak ?? getPrefs().autoSpeak,
  }

  if (hasWindow()) {
    window.localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(next))
  }

  return next
}

export function listVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = getSynth()
  if (!synth) return Promise.resolve([])

  const voices = synth.getVoices()
  if (voices.length > 0) return Promise.resolve(voices)

  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      synth.removeEventListener("voiceschanged", finish)
      resolve(synth.getVoices())
    }

    synth.addEventListener("voiceschanged", finish)
    window.setTimeout(finish, 1000)
  })
}

function splitLongSentence(sentence: string) {
  const chunks: string[] = []
  let rest = sentence.trim()

  while (rest.length > 200) {
    const slice = rest.slice(0, 200)
    const splitAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf(","), slice.lastIndexOf(";"))
    const index = splitAt > 80 ? splitAt + 1 : 200
    chunks.push(rest.slice(0, index).trim())
    rest = rest.slice(index).trim()
  }

  if (rest) chunks.push(rest)
  return chunks
}

function chunkText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return []

  const sentences = normalized.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [normalized]
  const chunks: string[] = []
  let current = ""

  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    if (sentence.length > 200) {
      if (current) chunks.push(current)
      chunks.push(...splitLongSentence(sentence))
      current = ""
      continue
    }

    const candidate = current ? `${current} ${sentence}` : sentence
    if (candidate.length > 200) {
      if (current) chunks.push(current)
      current = sentence
    } else {
      current = candidate
    }
  }

  if (current) chunks.push(current)
  return chunks
}

function pickVoice(voices: SpeechSynthesisVoice[], name: string | undefined, lang: string) {
  return (
    voices.find((voice) => voice.name === name) ??
    voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase()) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase())) ??
    voices[0] ??
    null
  )
}

export function speak(text: string, opts: SpeakOptions = {}): SpeakController {
  const synth = getSynth()
  const prefs = getPrefs()
  const lang = opts.lang ?? "vi-VN"
  const rate = clamp(opts.rate ?? prefs.rate, 0.5, 2, DEFAULT_PREFS.rate)
  const pitch = clamp(opts.pitch ?? prefs.pitch, 0.5, 2, DEFAULT_PREFS.pitch)
  const voiceName = opts.voice ?? prefs.voiceName
  const chunks = chunkText(text)
  let stopped = false
  let speaking = false
  let index = 0

  const controller: SpeakController = {
    stop: () => {
      stopped = true
      speaking = false
      synth?.cancel()
    },
    pause: () => synth?.pause(),
    resume: () => synth?.resume(),
    isSpeaking: () => speaking || Boolean(synth?.speaking),
  }

  if (!synth || chunks.length === 0) return controller

  synth.cancel()

  void listVoices().then((voices) => {
    if (stopped) return
    const voice = pickVoice(voices, voiceName, lang)

    const playNext = () => {
      if (stopped || index >= chunks.length) {
        speaking = false
        return
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index])
      utterance.lang = voice?.lang ?? lang
      utterance.rate = rate
      utterance.pitch = pitch
      if (voice) utterance.voice = voice
      utterance.onend = () => {
        index += 1
        playNext()
      }
      utterance.onerror = () => {
        index += 1
        playNext()
      }

      speaking = true
      synth.speak(utterance)
    }

    playNext()
  })

  return controller
}
