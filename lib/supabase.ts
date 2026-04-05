import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let supabase: any = null
let supabaseAdmin: any = null

// Initialize Supabase only if environment variables are available
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)

  // For server-side operations with service role
  supabaseAdmin = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
    {
      auth: {
        persistSession: false
      }
    }
  )
} else {
  console.warn('⚠️ Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
}

export { supabase, supabaseAdmin }
