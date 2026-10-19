import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured: boolean =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.trim().length > 0 &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.trim().length > 0

let client: SupabaseClient | null = null

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Environment variables are not configured. ' +
      'Aplikacija radi u fallback modu (LRC forma uključena, bez pravog spajanja na Supabase).'
  )
} else {
  client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}

export const supabase = client

