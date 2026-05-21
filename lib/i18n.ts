"use client"

import { useEffect, useState, useCallback } from "react"

// Minimal i18n framework. Dictionaries are intentionally small —
// extend `dicts` per page as needed. Falls back to the key if missing.

export type Locale = "vi" | "en" | "ja"

const STORAGE_KEY = "tans-agents:locale-v1"
const LOCALE_CHANGED_EVENT = "tans:locale-changed"

const dicts: Record<Locale, Record<string, string>> = {
  vi: {
    "common.back": "Quay lại",
    "common.cancel": "Hủy",
    "common.save": "Lưu",
    "common.delete": "Xóa",
    "common.clear": "Xóa dữ liệu",
    "common.download": "Tải xuống",
    "common.loading": "Đang tải...",
    "nav.chat": "Chat",
    "nav.stats": "Analytics",
    "nav.settings": "Cài đặt",
    "stats.title": "Analytics",
    "stats.subtitle": "Thống kê sử dụng local trên trình duyệt này.",
    "stats.total_messages": "Tổng messages",
    "stats.total_errors": "Tổng errors",
    "stats.avg_latency": "Avg latency",
    "stats.total_tools": "Total tool calls",
    "stats.ttft": "Latency leaderboard (TTFT)",
    "stats.ab_winners": "A/B winners",
    "stats.usage_by_day": "Usage by day",
    "chat.empty.title": "Bạn cần gì hôm nay?",
    "chat.empty.placeholder": "Nhập câu hỏi…",
  },
  en: {
    "common.back": "Back",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.clear": "Clear data",
    "common.download": "Download",
    "common.loading": "Loading...",
    "nav.chat": "Chat",
    "nav.stats": "Analytics",
    "nav.settings": "Settings",
    "stats.title": "Analytics",
    "stats.subtitle": "Usage statistics stored locally in this browser.",
    "stats.total_messages": "Total messages",
    "stats.total_errors": "Total errors",
    "stats.avg_latency": "Avg latency",
    "stats.total_tools": "Total tool calls",
    "stats.ttft": "Latency leaderboard (TTFT)",
    "stats.ab_winners": "A/B winners",
    "stats.usage_by_day": "Usage by day",
    "chat.empty.title": "What do you need today?",
    "chat.empty.placeholder": "Type a question…",
  },
  ja: {
    "common.back": "戻る",
    "common.cancel": "キャンセル",
    "common.save": "保存",
    "common.delete": "削除",
    "common.clear": "データ削除",
    "common.download": "ダウンロード",
    "common.loading": "読み込み中...",
    "nav.chat": "チャット",
    "nav.stats": "統計",
    "nav.settings": "設定",
    "stats.title": "統計",
    "stats.subtitle": "このブラウザに保存された利用統計です。",
    "stats.total_messages": "メッセージ合計",
    "stats.total_errors": "エラー合計",
    "stats.avg_latency": "平均遅延",
    "stats.total_tools": "ツール呼び出し合計",
    "stats.ttft": "レイテンシ・ランキング (TTFT)",
    "stats.ab_winners": "A/B 投票結果",
    "stats.usage_by_day": "日別利用",
    "chat.empty.title": "今日は何をしますか?",
    "chat.empty.placeholder": "質問を入力…",
  },
}

export const LOCALES: ReadonlyArray<{ code: Locale; label: string }> = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
]

function detectInitial(): Locale {
  if (typeof window === "undefined") return "vi"
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && (stored === "vi" || stored === "en" || stored === "ja")) return stored
  } catch {
    /* ignore */
  }
  const browser = (navigator.language || "vi").slice(0, 2).toLowerCase()
  if (browser === "en") return "en"
  if (browser === "ja") return "ja"
  return "vi"
}

export function getLocale(): Locale {
  if (typeof window === "undefined") return "vi"
  return detectInitial()
}

export function setLocale(locale: Locale): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
    window.dispatchEvent(new CustomEvent(LOCALE_CHANGED_EVENT, { detail: locale }))
  } catch {
    /* ignore */
  }
}

export function t(key: string, locale?: Locale): string {
  const loc = locale ?? getLocale()
  const dict = dicts[loc] || dicts.vi
  return dict[key] ?? dicts.vi[key] ?? key
}

export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void; t: (key: string) => string } {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitial())

  useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<Locale>).detail
      if (next === "vi" || next === "en" || next === "ja") setLocaleState(next)
    }
    window.addEventListener(LOCALE_CHANGED_EVENT, handler)
    return () => window.removeEventListener(LOCALE_CHANGED_EVENT, handler)
  }, [])

  const update = useCallback((next: Locale) => {
    setLocaleState(next)
    setLocale(next)
  }, [])

  const translator = useCallback((key: string) => t(key, locale), [locale])

  return { locale, setLocale: update, t: translator }
}
