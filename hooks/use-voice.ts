"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type SpeechRecognitionLike = any

type SpeechRecognitionOptions = {
  lang?: string
}

type SpeechSynthesisOptions = {
  lang?: string
  rate?: number
}

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

export function useSpeechRecognition({ lang = "vi-VN" }: SpeechRecognitionOptions = {}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")

  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor())
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionCtor()
    if (!SpeechRecognition) return

    recognitionRef.current?.stop()
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    setTranscript("")

    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (event: any) => {
      let nextTranscript = ""
      let hasFinal = false

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        nextTranscript += result?.[0]?.transcript ?? ""
        if (result?.isFinal) hasFinal = true
      }

      setTranscript(nextTranscript)
      if (hasFinal) {
        recognition.stop()
        setListening(false)
      }
    }

    recognition.start()
  }, [lang])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  return { supported, listening, transcript, start, stop }
}

export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window)
  }, [])

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback((text: string, opts: SpeechSynthesisOptions = {}) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = opts.lang ?? "vi-VN"
    utterance.rate = opts.rate ?? 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  useEffect(() => cancel, [cancel])

  return { supported, speaking, speak, cancel }
}
