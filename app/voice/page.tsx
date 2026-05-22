"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getPrefs, listVoices, setPrefs, speak, type VoicePrefs } from "@/lib/voice-tts"

const TEST_PHRASE = "Xin chào Tan, đây là giọng đọc thử của Tan's Agents."

function groupVoices(voices: SpeechSynthesisVoice[]) {
  return voices.reduce<Record<string, SpeechSynthesisVoice[]>>((acc, voice) => {
    const lang = voice.lang || "unknown"
    acc[lang] = [...(acc[lang] ?? []), voice]
    return acc
  }, {})
}

export default function VoiceSettingsPage() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [prefs, setLocalPrefs] = useState<VoicePrefs>(() => getPrefs())
  const [phrase, setPhrase] = useState(TEST_PHRASE)

  const groupedVoices = useMemo(() => groupVoices(voices), [voices])
  const voiceValue = prefs.voiceName || "__default"

  useEffect(() => {
    let active = true
    void listVoices().then((items) => {
      if (active) setVoices(items)
    })
    return () => {
      active = false
    }
  }, [])

  function updatePrefs(partial: Partial<VoicePrefs>) {
    setLocalPrefs(setPrefs(partial))
  }

  function testVoice() {
    speak(phrase, {
      voice: prefs.voiceName,
      rate: prefs.rate,
      pitch: prefs.pitch,
      lang: "vi-VN",
    })
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">🔊 Cài đặt giọng đọc</h1>
          <p className="text-sm text-muted-foreground">Dùng Web Speech API có sẵn trên trình duyệt, không cần API key.</p>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Quay lại
        </Link>
      </header>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="voice-select" className="text-sm font-medium">Giọng đọc</label>
            <Select
              value={voiceValue}
              onValueChange={(value) => updatePrefs({ voiceName: value === "__default" ? undefined : value })}
            >
              <SelectTrigger id="voice-select">
                <SelectValue placeholder="Chọn giọng đọc" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default">Mặc định tốt nhất</SelectItem>
                {Object.entries(groupedVoices).map(([lang, items]) => (
                  <SelectGroup key={lang}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{lang}</div>
                    {items.map((voice) => (
                      <SelectItem key={`${voice.name}-${voice.lang}`} value={voice.name}>
                        {voice.name} {voice.localService ? "(máy)" : "(online)"}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nếu chưa thấy giọng Việt Nam, hãy kiểm tra cài đặt giọng nói của hệ điều hành/trình duyệt.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Tốc độ</span>
                <span className="font-mono text-muted-foreground">{prefs.rate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={prefs.rate}
                onChange={(event) => updatePrefs({ rate: Number(event.target.value) })}
                className="w-full accent-primary"
              />
            </label>

            <label className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Cao độ</span>
                <span className="font-mono text-muted-foreground">{prefs.pitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={prefs.pitch}
                onChange={(event) => updatePrefs({ pitch: Number(event.target.value) })}
                className="w-full accent-primary"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-3">
            <div>
              <label htmlFor="auto-speak" className="text-sm font-medium">Tự động đọc câu trả lời</label>
              <p className="text-xs text-muted-foreground">Lưu cấu hình trước; nối vào chat.tsx sẽ làm ở bước sau.</p>
            </div>
            <button
              id="auto-speak"
              type="button"
              role="switch"
              aria-checked={prefs.autoSpeak}
              onClick={() => updatePrefs({ autoSpeak: !prefs.autoSpeak })}
              className="relative h-6 w-11 rounded-full border bg-muted transition-colors data-[state=checked]:bg-primary"
              data-state={prefs.autoSpeak ? "checked" : "unchecked"}
            >
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5" data-state={prefs.autoSpeak ? "checked" : "unchecked"} />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Thử giọng đọc</h2>
            <p className="text-sm text-muted-foreground">Nhập một câu tiếng Việt rồi bấm phát thử.</p>
          </div>
          <Input value={phrase} onChange={(event) => setPhrase(event.target.value)} placeholder="Nhập câu thử..." />
          <Button type="button" onClick={testVoice} disabled={!phrase.trim()}>
            Test phát
          </Button>
        </div>
      </section>
    </main>
  )
}
