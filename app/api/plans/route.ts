import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function adminClient() {
  return createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Authenticate request and return { user, isAdmin } or null */
async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
  if (error || !user) return null

  const supabase = adminClient()
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin'
  return { user, isAdmin, supabase }
}

// GET - list plans (all authenticated users can read active plans)
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const includeInactive = request.nextUrl.searchParams.get('all') === 'true'

    let query = auth.supabase.from('plans').select('*').order('position', { ascending: true })
    if (!includeInactive) query = query.eq('active', true)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ plans: data || [] })
  } catch (e) {
    console.error('[Plans API] GET error:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST - create plan (admin only)
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!auth.isAdmin) return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

    const body = await request.json()
    const { name, description, price, is_custom, position, active } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Nome do plano é obrigatório' }, { status: 400 })
    }

    const isCustom = !!is_custom
    const { data, error } = await auth.supabase
      .from('plans')
      .insert({
        name: String(name).trim(),
        description: description || null,
        price: isCustom ? null : (price !== undefined && price !== null && price !== '' ? parseFloat(price) : null),
        is_custom: isCustom,
        position: position ?? 0,
        active: active ?? true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Já existe um plano com este nome' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plan: data })
  } catch (e) {
    console.error('[Plans API] POST error:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH - update plan (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!auth.isAdmin) return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

    const body = await request.json()
    const { id, name, description, price, is_custom, position, active } = body
    if (!id) return NextResponse.json({ error: 'ID do plano é obrigatório' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = String(name).trim()
    if (description !== undefined) updates.description = description || null
    if (is_custom !== undefined) updates.is_custom = !!is_custom
    if (price !== undefined) {
      updates.price = is_custom ? null : (price === null || price === '' ? null : parseFloat(price))
    }
    if (is_custom) updates.price = null
    if (position !== undefined) updates.position = position
    if (active !== undefined) updates.active = active

    const { data, error } = await auth.supabase
      .from('plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Já existe um plano com este nome' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plan: data })
  } catch (e) {
    console.error('[Plans API] PATCH error:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE - delete plan (admin only). Soft via active=false if in use.
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!auth.isAdmin) return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID do plano é obrigatório' }, { status: 400 })

    // If plan is linked to leads, deactivate instead of hard delete
    const { count } = await auth.supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', id)

    if (count && count > 0) {
      const { error } = await auth.supabase.from('plans').update({ active: false }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, deactivated: true, message: 'Plano está vinculado a leads; foi desativado em vez de excluído.' })
    }

    const { error } = await auth.supabase.from('plans').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[Plans API] DELETE error:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
