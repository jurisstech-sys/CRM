import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    // Use service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    // Count leads with status "new"
    const { count: newCount, error: countError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    if (countError) {
      console.error('[Admin] Error counting leads:', countError);
      return NextResponse.json({ error: 'Erro ao contar leads' }, { status: 500 });
    }

    // Count total leads
    const { count: totalCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });

    // Count leads per status
    const { data: allLeads } = await supabase
      .from('leads')
      .select('status');

    const statusCounts: Record<string, number> = {};
    if (allLeads) {
      allLeads.forEach((lead: { status: string }) => {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
      });
    }

    return NextResponse.json({
      total_leads: totalCount || 0,
      leads_with_new_status: newCount || 0,
      status_breakdown: statusCounts,
    });
  } catch (error) {
    console.error('[Admin] GET Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    // Use service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    console.log(`[Admin Migration] User ${user.email} (${user.id}) initiated leads status migration`);

    // Count BEFORE
    const { count: beforeCount, error: beforeError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    if (beforeError) {
      console.error('[Admin Migration] Error counting before:', beforeError);
      return NextResponse.json({ error: 'Erro ao contar leads antes da migração' }, { status: 500 });
    }

    const leadsToMigrate = beforeCount || 0;

    if (leadsToMigrate === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum lead com status "new" encontrado. Nada a migrar.',
        before: 0,
        after: 0,
        migrated: 0,
      });
    }

    console.log(`[Admin Migration] Found ${leadsToMigrate} leads with status "new". Migrating to "backlog"...`);

    // First, update the check constraint to allow new statuses (using pg directly)
    // This is done via Supabase RPC or will be handled by the constraint already being updated
    
    // Execute migration
    const { error: updateError } = await supabase
      .from('leads')
      .update({ status: 'backlog' })
      .eq('status', 'new');

    if (updateError) {
      console.error('[Admin Migration] Error updating leads:', updateError);
      return NextResponse.json({ error: `Erro ao atualizar leads: ${updateError.message}` }, { status: 500 });
    }

    // Count AFTER
    const { count: afterCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    const remainingNew = afterCount || 0;
    const migrated = leadsToMigrate - remainingNew;

    console.log(`[Admin Migration] Migration complete. Migrated: ${migrated}, Remaining with 'new': ${remainingNew}`);

    // Get updated status breakdown
    const { data: allLeads } = await supabase
      .from('leads')
      .select('status');

    const statusCounts: Record<string, number> = {};
    if (allLeads) {
      allLeads.forEach((lead: { status: string }) => {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
      });
    }

    return NextResponse.json({
      success: true,
      message: `Migração concluída com sucesso! ${migrated} leads migrados de "new" para "backlog".`,
      before: leadsToMigrate,
      after: remainingNew,
      migrated,
      status_breakdown: statusCounts,
      executed_by: user.email,
      executed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin Migration] POST Error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
