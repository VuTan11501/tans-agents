"use client"

import { useCallback, useEffect, useState } from "react"
import { loadUserKeys, saveUserKeys, type UserKeyProvider, type UserKeys } from "@/lib/user-keys"

export function useUserKeys() {
  const [keys, setKeys] = useState<UserKeys>({})

  useEffect(() => {
    setKeys(loadUserKeys())
  }, [])

  const setKey = useCallback((provider: UserKeyProvider, value: string) => {
    setKeys((current) => {
      const next: UserKeys = { ...current }
      const trimmed = value.trim()
      if (trimmed) next[provider] = trimmed
      else delete next[provider]
      saveUserKeys(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setKeys({})
    saveUserKeys({})
  }, [])

  return { keys, setKey, clearAll }
}
