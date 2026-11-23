import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface Settings {
  id: number
  is_lrc_form_enabled: boolean
  interiors_public_visible: boolean
  lrc_public_visible: boolean
  web_atelier_public_visible: boolean
  interiors_vr_enabled: boolean
  lrc_webshop_enabled: boolean
  lrc_webshop_url: string | null
}

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  is_lrc_form_enabled: true,
  interiors_public_visible: true,
  lrc_public_visible: false,
  web_atelier_public_visible: false,
  interiors_vr_enabled: false,
  lrc_webshop_enabled: false,
  lrc_webshop_url: null,
}

const SETTINGS_KEYS: (keyof Settings)[] = [
  'id',
  'is_lrc_form_enabled',
  'interiors_public_visible',
  'lrc_public_visible',
  'web_atelier_public_visible',
  'interiors_vr_enabled',
  'lrc_webshop_enabled',
  'lrc_webshop_url',
]

/** Merge a server row without wiping fields that are missing from the response (PostgREST/RLS/cache). */
function mergeSettingsFromServer(
  prev: Settings | null,
  row: Record<string, unknown> | null | undefined,
  patch?: Partial<Settings>,
): Settings {
  const base: Settings = { ...DEFAULT_SETTINGS, ...(prev ?? {}) }
  if (!row || typeof row !== 'object') {
    return patch ? { ...base, ...patch } : base
  }

  const next: Settings = { ...base }
  for (const k of SETTINGS_KEYS) {
    if (k === 'id') {
      const v = row[k]
      if (typeof v === 'number') next.id = v
      continue
    }
    if (k === 'lrc_webshop_url') {
      const v = row[k]
      if (typeof v === 'string' || v === null) next.lrc_webshop_url = v
      continue
    }
    if (Object.prototype.hasOwnProperty.call(row, k)) {
      const v = row[k as string]
      if (typeof v === 'boolean') {
        next[k] = v
      }
    }
  }

  return patch ? { ...next, ...patch } : next
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSettings() {
      setIsLoading(true)
      setError(null)

      // Skip API call if Supabase is not configured
      if (!isSupabaseConfigured) {
        setSettings(DEFAULT_SETTINGS)
        setIsLoading(false)
        return
      }

      if (!supabase) {
        throw new Error('Supabase klijent nije dostupan.')
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 1)
          .single()

        if (fetchError) {
          throw fetchError
        }

        setSettings(mergeSettingsFromServer(null, data as Record<string, unknown>))
      } catch (err) {
        console.error('Error fetching settings:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch settings')
        // Fallback to default settings if Supabase call fails
        setSettings(DEFAULT_SETTINGS)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  async function updateSettings(updates: Partial<Settings>) {
    setError(null)

    // Skip API call if Supabase is not configured
    if (!isSupabaseConfigured) {
      const updatedSettings = { ...DEFAULT_SETTINGS, ...updates }
      setSettings(updatedSettings)
      return { success: true, data: updatedSettings }
    }

    if (!supabase) {
      return { success: false, error: 'Supabase klijent nije dostupan.' }
    }

    try {
      const { data, error: updateError } = await supabase
        .from('settings')
        .update(updates)
        .eq('id', 1)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      setSettings((prev) =>
        mergeSettingsFromServer(
          prev,
          data as Record<string, unknown>,
          updates,
        ),
      )
      return { success: true, data }
    } catch (err) {
      console.error('Error updating settings:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  return {
    settings,
    isLoading,
    error,
    updateSettings,
  }
}

