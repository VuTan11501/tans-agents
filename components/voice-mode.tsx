"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, Radio, Volume2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  cancelSpeech,
  ContinuousSpeechRecognition,
  DEFAULT_VOICE_LANG,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  VOICE_MODE_LANG_KEY,
  VOICE_MODE_ON_KEY,
  type VoiceRecognitionStatus,
} from "@/lib/voice"

function dispatchVoiceMessage(text: string) {
  window.dispatchEvent(new CustomEvent("tans:voice-send", { detail: { text } }))
}

function fillComposerAndSubmit(text: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea:not([disabled])")
  const form = textarea?.closest("form")
  if (!textarea || !form) return false

  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
  setter?.call(textarea, text)
  textarea.dispatchEvent(new Event("input", { bubbles: true }))

  window.setTimeout(() => {
    if (typeof form.requestSubmit === "function") form.requestSubmit()
    else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  }, 80)

  return true
}

function getLastAssistantText() {
  const prose = Array.from(document.querySelectorAll<HTMLElement>(".prose-chat"))
  const last = prose.at(-1)
  if (!last || last.classList.contains("prose-chat-streaming")) return ""
  return last.innerText.trim()
}

export function VoiceMode() {
  const recognitionRef = useRef<ContinuousSpeechRecognition | null>(null)
  const transcriptRef = useRef("")
  const lastUpdateRef = useRef(0)
  const spokenTextRef = useRef("")
  const speakingRef = useRef(false)
  const [enabled, setEnabled] = useState(false)
  const [lang, setLang] = useState(DEFAULT_VOICE_LANG)
  const [supported, setSupported] = useState({ stt: false, tts: false })
  const [status, setStatus] = useState<VoiceRecognitionStatus>("idle")
  const [transcript, setTranscript] = useState("")
  const [lastSent, setLastSent] = useState("")
  const [error, setError] = useState("")
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    setSupported({ stt: isSpeechRecognitionSupported(), tts: isSpeechSynthesisSupported() })
    setLang(localStorage.getItem(VOICE_MODE_LANG_KEY) || DEFAULT_VOICE_LANG)
    setEnabled(localStorage.getItem(VOICE_MODE_ON_KEY) === "true")
  }, [])

  useEffect(() => {
    const handleToggle = () => setEnabled((current) => !current)
    window.addEventListener("tans:voice-toggle", handleToggle)
    return () => window.removeEventListener("tans:voice-toggle", handleToggle)
  }, [])

  useEffect(() => {
    localStorage.setItem(VOICE_MODE_ON_KEY, enabled ? "true" : "false")
    if (!enabled) cancelSpeech()
  }, [enabled])

  useEffect(() => {
    localStorage.setItem(VOICE_MODE_LANG_KEY, lang)
    recognitionRef.current?.setLang(lang)
  }, [lang])

  useEffect(() => {
    recognitionRef.current = new ContinuousSpeechRecognition({
      lang,
      onStatus: setStatus,
      onError: setError,
      onTranscript: (next) => {
        if (speakingRef.current) return
        transcriptRef.current = next
        setTranscript(next)
        if (next.trim()) lastUpdateRef.current = Date.now()
      },
    })
    return () => recognitionRef.current?.destroy()
  }, [])

  useEffect(() => {
    if (!recognitionRef.current) return
    if (enabled && supported.stt) {
      setError("")
      recognitionRef.current.setLang(lang)
      recognitionRef.current.start()
      spokenTextRef.current = getLastAssistantText()
      return
    }

    recognitionRef.current.stop()
  }, [enabled, lang, supported.stt])

  const finalizeTranscript = useCallback(() => {
    const text = transcriptRef.current.trim()
    if (!text) return

    transcriptRef.current = ""
    setTranscript("")
    setLastSent(text)
    dispatchVoiceMessage(text)
    fillComposerAndSubmit(text)
    recognitionRef.current?.restart()
  }, [])

  useEffect(() => {
    if (!enabled || !supported.stt) return
    const timer = window.setInterval(() => {
      if (!transcriptRef.current.trim()) return
      if (Date.now() - lastUpdateRef.current > 2000) finalizeTranscript()
    }, 250)
    return () => window.clearInterval(timer)
  }, [enabled, finalizeTranscript, supported.stt])

  useEffect(() => {
    if (!enabled || !supported.tts) return

    let pending: number | null = null
    const maybeSpeak = () => {
      if (pending) window.clearTimeout(pending)
      pending = window.setTimeout(async () => {
        const text = getLastAssistantText()
        if (!text || text === spokenTextRef.current) return
        spokenTextRef.current = text
        await speakText(text, {
          lang,
          onStart: () => {
            speakingRef.current = true
            setSpeaking(true)
          },
          onEnd: () => {
            speakingRef.current = false
            setSpeaking(false)
          },
          onError: () => {
            speakingRef.current = false
            setSpeaking(false)
          },
        })
      }, 500)
    }

    const observer = new MutationObserver(maybeSpeak)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] })
    maybeSpeak()

    return () => {
      if (pending) window.clearTimeout(pending)
      observer.disconnect()
    }
  }, [enabled, lang, supported.tts])

  if (!enabled) return null

  const unavailable = !supported.stt
  const listening = status === "listening" && !unavailable

  return (
    <div className="fixed bottom-24 right-4 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-border/70 bg-background/95 p-4 shadow-2xl backdrop-blur-xl sm:bottom-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className={cn("relative flex h-2.5 w-2.5 rounded-full", listening ? "bg-red-500" : "bg-muted-foreground")}>
              {listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-75" />}
            </span>
            Chế độ giọng nói
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {unavailable ? "Trình duyệt chưa hỗ trợ nhận giọng nói." : "Tự gửi sau 2 giây im lặng."}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEnabled(false)} aria-label="Tắt voice mode">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-card/70 p-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", listening ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground")}>
          {speaking ? <Volume2 className="h-5 w-5 animate-pulse" /> : listening ? <Mic className="h-5 w-5 animate-pulse" /> : <Radio className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium">
            {speaking ? "Đang đọc câu trả lời" : listening ? "Đang nghe..." : unavailable ? "Không khả dụng" : "Đang khởi động..."}
          </div>
          <div className="mt-1 flex h-4 items-end gap-0.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className={cn("w-1 rounded-full bg-violet-500/70", (speaking || listening) && "animate-pulse")}
                style={{ height: `${6 + ((bar * 5) % 12)}px`, animationDelay: `${bar * 90}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      <label className="mt-3 block text-[11px] font-medium text-muted-foreground" htmlFor="voice-lang">
        Ngôn ngữ nhận giọng nói
      </label>
      <input
        id="voice-lang"
        value={lang}
        onChange={(event) => setLang(event.target.value || DEFAULT_VOICE_LANG)}
        className="mt-1 h-8 w-full rounded-lg border bg-background px-2 text-xs outline-none focus:border-foreground/40"
        placeholder="vi-VN"
        disabled={unavailable}
      />

      {(transcript || lastSent || error) && (
        <div className="mt-3 rounded-2xl bg-muted/50 p-3 text-xs">
          {transcript && <p><span className="font-medium">Đang nghe:</span> {transcript}</p>}
          {!transcript && lastSent && <p><span className="font-medium">Đã gửi:</span> {lastSent}</p>}
          {error && <p className="mt-1 text-destructive">{error}</p>}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button className="flex-1 rounded-full" size="sm" disabled={unavailable} onClick={() => (listening ? recognitionRef.current?.stop() : recognitionRef.current?.start())}>
          {listening ? "Tạm dừng mic" : "Mở mic"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          size="sm"
          disabled={!speaking}
          onClick={() => {
            cancelSpeech()
            speakingRef.current = false
            setSpeaking(false)
          }}
        >
          Dừng đọc
        </Button>
      </div>
    </div>
  )
}
