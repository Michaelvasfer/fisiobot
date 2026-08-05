'use client'

// ============================================================
// Fetcher compartido para las API routes del dashboard.
// useApiData hace polling cada `refreshMs` para mantener los
// datos frescos sin dependencias extra.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { authFetch } from '@/lib/auth'

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  })
  if (!res.ok) {
    throw new Error(`Error ${res.status} al consultar ${url}`)
  }
  return res.json() as Promise<T>
}

interface ApiDataState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// Si url es null no se hace fetch (útil para recursos condicionales).
export function useApiData<T>(url: string | null, refreshMs = 15000): ApiDataState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(url))
  const [error, setError] = useState<string | null>(null)
  const cargando = useRef(false)

  const cargar = useCallback(async (inicial: boolean) => {
    if (!url || cargando.current) return
    cargando.current = true
    if (inicial) setLoading(true)
    try {
      const json = await fetchApi<T>(url)
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      cargando.current = false
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    // Al cambiar de recurso se limpia el estado anterior.
    setData(null)
    setError(null)
    setLoading(Boolean(url))
    cargar(true)
    if (!url || refreshMs <= 0) return
    const id = setInterval(() => cargar(false), refreshMs)
    return () => clearInterval(id)
  }, [cargar, refreshMs, url])

  return { data, loading, error, refetch: () => cargar(false) }
}
