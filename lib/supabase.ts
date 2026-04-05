import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client that syncs session to cookies (required for middleware auth)
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations (service role key)
let supabaseAdmin: ReturnType<typeof createClient> | null = null
if (supabaseUrl && (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey)) {
  supabaseAdmin = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
    {
      auth: {
        persistSession: false
      }
    }
  )
}

export { supabase, supabaseAdmin }
