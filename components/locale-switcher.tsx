"use client"

import { useLocale, LOCALES, type Locale } from "@/lib/i18n"

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale()
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="h-8 rounded-md border bg-background px-2 text-xs"
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  )
}
