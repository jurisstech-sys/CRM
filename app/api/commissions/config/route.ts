import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// GET - Fetch all commission configs
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient()
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    // Fetch commission configs
    const { data, error } = await supabase
      .from('commission_config')
      .select('*, users!commission_config_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })

    if (error) {
      // If table doesn't exist, try creating it and return empty
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        await createCommissionConfigTable(supabase)
        return NextResponse.json({ data: [] })
      }
      console.error('Error fetching commission configs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Error in commission config GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update commission config
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminClient()
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { configs } = body

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json({ error: 'configs array required' }, { status: 400 })
    }

    // Ensure table exists
    await createCommissionConfigTable(supabase)

    // Upsert each config
    const results = []
    for (const config of configs) {
      const { user_id, stage, percentage } = config
      if (!user_id || !stage || percentage === undefined) continue

      const { data, error } = await supabase
        .from('commission_config')
        .upsert(
          {
            user_id,
            stage,
            percentage: parseFloat(percentage),
            created_by: authUser.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,stage' }
        )
        .select()

      if (error) {
        console.error('Error upserting config:', error)
      } else {
        results.push(data)
      }
    }

    return NextResponse.json({ data: results, message: 'Configurações salvas com sucesso' })
  } catch (error) {
    console.error('Error in commission config POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function createCommissionConfigTable(supabase: any) {
  try {
    await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS commission_config (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          stage VARCHAR(50) NOT NULL,
          percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, stage)
        );
        CREATE INDEX IF NOT EXISTS idx_commission_config_user_id ON commission_config(user_id);
        CREATE INDEX IF NOT EXISTS idx_commission_config_stage ON commission_config(stage);
      `
    })
  } catch (e) {
    // Table might already exist or RPC not available, try direct SQL
    try {
      const { error } = await supabase.from('commission_config').select('id').limit(1)
      if (error && error.code === '42P01') {
        // Table doesn't exist - it will be created via setup route
        console.log('commission_config table needs to be created via setup')
      }
    } catch (e2) {
      console.error('Could not verify commission_config table:', e2)
    }
  }
}
