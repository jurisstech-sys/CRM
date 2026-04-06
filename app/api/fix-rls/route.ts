import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Count all leads
    const { data: allLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, title, status, assigned_to, created_by')
      .order('created_at', { ascending: false })

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 })
    }

    // 2. Check all users
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')

    // 3. Get status breakdown
    const statusBreakdown: Record<string, number> = {}
    allLeads?.forEach(l => {
      statusBreakdown[l.status || 'null'] = (statusBreakdown[l.status || 'null'] || 0) + 1
    })

    // 4. Check RLS policies
    const { data: policies } = await supabase
      .rpc('exec_sql', { sql_query: "SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename = 'leads';" })
      .maybeSingle()

    return NextResponse.json({
      total_leads: allLeads?.length || 0,
      status_breakdown: statusBreakdown,
      sample_leads: allLeads?.slice(0, 5),
      users: allUsers,
      users_error: usersError?.message,
      rls_policies: policies,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Fix: Update all leads with null/empty status to 'backlog'
    const { data: fixedNull, error: fixNullErr } = await supabase
      .from('leads')
      .update({ status: 'backlog' })
      .or('status.is.null,status.eq.')
      .select('id')

    // Fix: Update leads with old status names  
    const statusMap: Record<string, string> = {
      'new': 'backlog',
      'contacted': 'em_contato',
      'negotiation': 'em_negociacao',
      'won': 'negociacao_fechada',
      'lost': 'lead_nao_qualificado',
    }

    let fixedOld = 0
    for (const [oldStatus, newStatus] of Object.entries(statusMap)) {
      const { data } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('status', oldStatus)
        .select('id')
      fixedOld += data?.length || 0
    }

    return NextResponse.json({
      success: true,
      fixed_null_status: fixedNull?.length || 0,
      fixed_old_status: fixedOld,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
