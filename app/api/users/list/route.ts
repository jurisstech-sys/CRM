import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// GET: List all users (requires admin authentication)
export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Configuração incompleta' }, { status: 500 });
    }

    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // Verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Self-healing: reconcile Supabase Auth with public.users so that ANY user
    // that exists in Auth always has a profile row and therefore appears in every
    // selector (fixes "new users não aparecem nos filtros").
    try {
      const { data: authList } = await supabase.auth.admin.listUsers();
      const authUsers = authList?.users || [];

      // Current profiles (including soft-deleted, to avoid resurrecting them)
      const { data: existingProfiles } = await supabase
        .from('users')
        .select('id, deleted_at');
      const existingMap = new Map(
        (existingProfiles || []).map((u) => [u.id, u])
      );

      // Insert a profile for any Auth user that has no row at all.
      const missing = authUsers.filter((au) => !existingMap.has(au.id));
      if (missing.length > 0) {
        const rows = missing.map((au) => ({
          id: au.id,
          email: au.email,
          full_name:
            (au.user_metadata && (au.user_metadata.full_name as string)) || null,
          role: 'comercial',
          status: 'active',
          deleted_at: null,
          updated_at: new Date().toISOString(),
        }));
        const { error: healErr } = await supabase.from('users').upsert(rows, { onConflict: 'id' });
        if (healErr) {
          console.warn('[Users List API] Auto-heal insert warning:', healErr.message);
        } else {
          console.log(`[Users List API] Auto-heal: criados ${rows.length} perfis ausentes`);
        }
      }
    } catch (healError) {
      // Never fail the listing because of the reconciliation step
      console.warn('[Users List API] Auto-heal skipped:', healError instanceof Error ? healError.message : healError);
    }

    // Fetch all active (non-deleted) users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, commission_rate, created_at')
      .is('deleted_at', null)
      .neq('status', 'inactive')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('[Users List API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[Users List API] Found ${users?.length || 0} users`);

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    console.error('[Users List API] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
