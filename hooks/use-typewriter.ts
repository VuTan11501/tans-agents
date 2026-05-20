"use client"
import { useEffect, useRef, useState } from "react"

/**
 * Adaptive typewriter buffer — decouples upstream chunk arrival from render
 * rate so the UI always feels like it's typing char-by-char even when the
 * model batches 5-10+ tokens per chunk (Gemini, cached prompts) or finishes
 * in a single payload.
 *
 * Adapted from Code/docs/js/ai-agent.js createTypewriter:
 *   remaining > 800 → take = ceil(remaining / 30)    (burst flush, catch up fast)
 *   remaining > 200 → take = 5
 *   remaining >  80 → take = 3
 *   remaining >  25 → take = 2
 *   else            → take = 1
 *
 * At 60fps that gives a baseline ~60-180 chars/sec when streaming smoothly
 * (≈ ChatGPT cadence), and a burst mode that drains 1KB+ payloads in <1s so
 * long replies don't lag forever.
 *
 * The animation runs INDEPENDENTLY of whether the network stream is still
 * open — providers that finish in one chunk still get animated. We only
 * "snap" to target instantly when target shrinks (= new message reset).
 *
 * @param target  latest fully-received text from useChat
 */
export function useTypewriter(target: string, instant = false) {
  const [displayed, setDisplayed] = useState<string>(instant ? target : "")
  const rafRef = useRef<number | null>(null)
  const displayedRef = useRef<string>(instant ? target : "")
  const targetRef = useRef<string>(target)
  targetRef.current = target
  const hasAnimatedRef = useRef<boolean>(!instant)

  useEffect(() => {
    // Snap-reset when target shrinks (e.g. new conversation / regenerate).
    if (target.length < displayedRef.current.length) {
      displayedRef.current = target
      setDisplayed(target)
      return
    }
    // Skip animation entirely for already-loaded history (instant=true and
    // we haven't started animating yet).
    if (instant && !hasAnimatedRef.current) {
      displayedRef.current = target
      setDisplayed(target)
      return
    }
    if (displayedRef.current.length >= target.length) return
    if (rafRef.current != null) return
    hasAnimatedRef.current = true

    const tick = () => {
      const cur = displayedRef.current
      const tgt = targetRef.current
      const remaining = tgt.length - cur.length
      if (remaining <= 0) {
        rafRef.current = null
        return
      }
      let take: number
      if (remaining > 800) take = Math.ceil(remaining / 30)
      else if (remaining > 200) take = 5
      else if (remaining > 80) take = 3
      else if (remaining > 25) take = 2
      else take = 1
      const next = tgt.slice(0, cur.length + take)
      displayedRef.current = next
      setDisplayed(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [target, instant])

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    []
  )

  return displayed
}
