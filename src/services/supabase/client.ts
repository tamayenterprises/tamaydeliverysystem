import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfiguration = {
  isComplete: Boolean(supabaseUrl && supabaseAnonKey),
  hasPartialConfiguration: Boolean(supabaseUrl) !== Boolean(supabaseAnonKey),
}

export const supabase = (() => {
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
})()

export function requireSupabase() {
  if (!supabaseConfiguration.isComplete || !supabase) {
    throw new Error(
      'Scheduling data is not connected. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  return supabase
}
