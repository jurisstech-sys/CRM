import { NextResponse } from 'next/server'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  return NextResponse.json({
    status: 'ok',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? `${anonKey.substring(0, 15)}... (${anonKey.length} chars)` : 'NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: serviceKey ? `${serviceKey.substring(0, 15)}... (${serviceKey.length} chars)` : 'NOT SET',
    },
    timestamp: new Date().toISOString(),
  })
}
