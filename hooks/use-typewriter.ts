"use client"
import { useEffect, useRef, useState } from "react"

/**
 * Smoothly reveals incoming streaming text, ChatGPT-style.
 *
 * Even when an upstream provider (e.g. Gemini) delivers chunks of 50+ chars
 * at once, the visible text advances character-by-character at a target rate
 * so the UI always *feels* like it's typing. When streaming ends, any
 * remaining buffered text is flushed immediately.
 *
 * @param target  the latest fully-received text
 * @param isStreaming  whether the provider stream is still open
 * @param charsPerSecond  reveal speed (default ~45 wpm equivalent for code blocks)
 */
export function useTypewriter(target: string, isStreaming: boolean, charsPerSecond = 220) {
  const [displayed, setDisplayed] = useState(target)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const displayedRef = useRef<string>(target)

  // Keep ref in sync so the rAF loop reads the latest value without resubscribing.
  useEffect(() => {
    displayedRef.current = displayed
  }, [displayed])

  useEffect(() => {
    // When streaming ends or text shrinks (new message), snap to target instantly.
    if (!isStreaming || target.length < displayedRef.current.length) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      setDisplayed(target)
      return
    }
    // If we're already caught up, nothing to do.
    if (displayedRef.current.length >= target.length) return

    const tick = (now: number) => {
      const last = lastTickRef.current || now
      const dt = now - last
      lastTickRef.current = now
      const charsToAdd = Math.max(1, Math.round((dt / 1000) * charsPerSecond))
      const cur = displayedRef.current
      const next = target.slice(0, Math.min(target.length, cur.length + charsToAdd))
      if (next !== cur) setDisplayed(next)
      if (next.length < target.length) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }
    lastTickRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [target, isStreaming, charsPerSecond])

  return displayed
}
