import { useEffect } from "react"

export interface Hotkey {
  combo: string // ví dụ "mod+k" (mod = ctrl trên Win/Linux, cmd trên Mac), "shift+?", "escape"
  handler: (e: KeyboardEvent) => void
  // Chặn shortcut khi user đang gõ trong input/textarea/contenteditable (default: true,
  // trừ khi combo chứa "mod" — Ctrl+K vẫn work trong input)
  allowInInput?: boolean
}

export function useHotkeys(hotkeys: Hotkey[]) {
  useEffect(() => {
    function normalize(combo: string) {
      return combo
        .toLowerCase()
        .split("+")
        .map((s) => s.trim())
        .sort()
        .join("+")
    }
    function eventCombo(e: KeyboardEvent): string {
      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push("mod")
      if (e.shiftKey) parts.push("shift")
      if (e.altKey) parts.push("alt")
      const key = e.key.toLowerCase()
      // Exclude modifier-only keypress
      if (!["control", "meta", "shift", "alt"].includes(key)) parts.push(key)
      return parts.sort().join("+")
    }
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const inInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target as any).isContentEditable)
      const combo = eventCombo(e)
      for (const hk of hotkeys) {
        if (normalize(hk.combo) !== combo) continue
        const usesMod = hk.combo.toLowerCase().includes("mod")
        if (inInput && !usesMod && !hk.allowInInput) continue
        e.preventDefault()
        hk.handler(e)
        return
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hotkeys])
}
