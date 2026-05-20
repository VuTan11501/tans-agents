"use client"
import { useEffect, useRef, useState } from "react"

/**
 * Smoothly reveals incoming streaming text, ChatGPT-style.
 *
 * Even when an upstream provider (e.g. Gemini) delivers the whole response
 * in a single chunk, the visible text advances character-by-character at a
 * target rate so the UI always *feels* like it's typing. The animation keeps
 * running until `displayed` catches up to `target`, regardless of whether
 * the network stream is still open — this is critical because some providers
 * (Gemini, GitHub Models with cached prompts) finish streaming before the
 * first paint frame.
 *
 * The hook only "snaps" to the target instantly when the target shrinks,
 * which signals a new conversation / message reset.
 *
 * @param target  the latest fully-received text from useChat
 * @param charsPerSecond  reveal speed
 */
export function useTypewriter(target: string, charsPerSecond = 260) {
  const [displayed, setDisplayed] = useState<string>("")
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const displayedRef = useRef<string>("")
  const targetRef = useRef<string>(target)
  targetRef.current = target

  useEffect(() => {
    // Snap on reset (new message starts → target shorter than displayed).
    if (target.length < displayedRef.current.length) {
      displayedRef.current = target
      setDisplayed(target)
      lastTickRef.current = 0
      return
    }
    // Already caught up — nothing to animate.
    if (displayedRef.current.length >= target.length) return
    // Already animating — the running loop will pick up the new target via ref.
    if (rafRef.current != null) return

    const tick = (now: number) => {
      const last = lastTickRef.current || now
      const dt = Math.max(0, now - last)
      lastTickRef.current = now
      const cur = displayedRef.current
      const tgt = targetRef.current
      if (cur.length >= tgt.length) {
        rafRef.current = null
        return
      }
      // Smooth speed: ~charsPerSecond, plus a "catch-up" boost if we're far behind.
      const behind = tgt.length - cur.length
      const baseChars = Math.max(1, Math.round((dt / 1000) * charsPerSecond))
      const catchupBoost = behind > 200 ? Math.floor(behind / 40) : 0
      const charsToAdd = baseChars + catchupBoost
      const next = tgt.slice(0, cur.length + charsToAdd)
      displayedRef.current = next
      setDisplayed(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    lastTickRef.current = 0
    rafRef.current = requestAnimationFrame(tick)
  }, [target, charsPerSecond])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return displayed
}

