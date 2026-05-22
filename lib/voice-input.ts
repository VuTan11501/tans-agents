type VoiceResultHandler = (text: string, isFinal: boolean) => void

type VoiceRecognizerOptions = {
  lang?: string
  onResult: VoiceResultHandler
  onError: (msg: string) => void
  onEnd?: () => void
}

type VoiceRecognizer = {
  start: () => void
  stop: () => void
  supported: boolean
}

const noopRecognizer: VoiceRecognizer = {
  start() {},
  stop() {},
  supported: false,
}

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

export function createVoiceRecognizer({ lang = "vi-VN", onResult, onError, onEnd }: VoiceRecognizerOptions): VoiceRecognizer {
  const SpeechRecognition = getSpeechRecognitionCtor()
  if (!SpeechRecognition) return noopRecognizer

  let recognition: any = null

  return {
    supported: true,
    start() {
      try {
        recognition?.stop()
        recognition = new SpeechRecognition()
        recognition.lang = lang
        recognition.continuous = false
        recognition.interimResults = true

        recognition.onresult = (event: any) => {
          let text = ""
          let isFinal = false

          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i]
            text += result?.[0]?.transcript ?? ""
            if (result?.isFinal) isFinal = true
          }

          onResult(text, isFinal)
        }

        recognition.onerror = (event: any) => {
          onError(event?.error ? `Lỗi nhận giọng nói: ${event.error}` : "Không thể nhận giọng nói")
        }
        recognition.onend = () => onEnd?.()

        recognition.start()
      } catch (error) {
        onError(error instanceof Error ? error.message : "Không thể bật nhận giọng nói")
      }
    },
    stop() {
      try {
        recognition?.stop()
      } catch {}
    },
  }
}
