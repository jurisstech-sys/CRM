import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Testing Supabase connection...')
console.log('URL:', SUPABASE_URL)
console.log('Key length:', SUPABASE_SERVICE_ROLE_KEY?.length)

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '')

// Test basic connection
;(async () => {
  try {
    const result = await supabase.from('users').select('*').limit(1)
    console.log('✅ Connection successful!')
    console.log('Result:', result)
  } catch (error: any) {
    console.log('❌ Connection error:', error.message)
  }
})()
