import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL ou ANON_KEY não configurados')
}

// Browser client that syncs session to cookies (required for middleware auth)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
