"use client"

import { useEffect, useRef, useState } from "react"
import { Volume2, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { speak, type SpeakController } from "@/lib/voice-tts"
import { cn } from "@/lib/utils"

type VoiceToggleButtonProps = {
  text: string
  className?: string
  label?: string
}

export function VoiceToggleButton({ text, className, label = "Phát giọng nói" }: VoiceToggleButtonProps) {
  const controllerRef = useRef<SpeakController | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIsSpeaking(Boolean(controllerRef.current?.isSpeaking()))
    }, 250)

    return () => {
      window.clearInterval(id)
      controllerRef.current?.stop()
    }
  }, [])

  function toggle() {
    if (controllerRef.current?.isSpeaking()) {
      controllerRef.current.stop()
      setIsSpeaking(false)
      return
    }

    controllerRef.current = speak(text)
    setIsSpeaking(true)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 rounded-full", className)}
      onClick={toggle}
      disabled={!text.trim()}
      aria-label={isSpeaking ? "Dừng phát giọng nói" : label}
      aria-pressed={isSpeaking}
      title={isSpeaking ? "Dừng phát" : label}
    >
      {isSpeaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </Button>
  )
}
