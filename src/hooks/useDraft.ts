import { useCallback } from 'react'

interface DraftEnvelope<T> {
  data: T
  savedAt: string
}

export function useDraft<T>(key: string) {
  const load = useCallback((): DraftEnvelope<T> | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as DraftEnvelope<T>) : null
    } catch {
      return null
    }
  }, [key])

  const save = useCallback(
    (data: T) => {
      if (typeof window === 'undefined') return
      try {
        const envelope: DraftEnvelope<T> = { data, savedAt: new Date().toISOString() }
        localStorage.setItem(key, JSON.stringify(envelope))
      } catch {}
    },
    [key],
  )

  const clear = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch {}
  }, [key])

  return { load, save, clear }
}
