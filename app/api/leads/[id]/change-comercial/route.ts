import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/leads/[id]/change-comercial
 * Permite que um ADMINISTRADOR altere manualmente o comercial responsável por um lead.
 * Registra auditoria completa em activity_logs (comercial anterior, novo, admin, motivo).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const leadId = params.id;
    if (!leadId) {
      return NextResponse.json({ error: 'ID do lead é obrigatório' }, { status: 400 });
    }

    // Autenticação
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

    // Service role para bypass de RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verifica se é admin
    const { data: requester } = await supabase
      .from('users')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();
    const isAdmin = requester?.role === 'admin' || requester?.role === 'super_admin';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar o comercial responsável.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { comercialId, reason } = body as { comercialId: string | null; reason?: string };

    // Busca o lead atual
    const { data: lead } = await supabase
      .from('leads')
      .select('id, title, comercial_id')
      .eq('id', leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    // Valida o novo comercial (se informado — permitir null para "remover")
    let newComercial: { id: string; full_name: string | null; email: string } | null = null;
    if (comercialId) {
      const { data: candidate } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('id', comercialId)
        .is('deleted_at', null)
        .neq('status', 'inactive')
        .single();
      if (!candidate) {
        return NextResponse.json(
          { error: 'Comercial selecionado é inválido ou está inativo.' },
          { status: 400 }
        );
      }
      newComercial = candidate;
    }

    // Resolve nome do comercial anterior para auditoria
    let previousName = 'Nenhum';
    if (lead.comercial_id) {
      const { data: prev } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', lead.comercial_id)
        .single();
      previousName = prev?.full_name || prev?.email || lead.comercial_id;
    }

    if (lead.comercial_id === (comercialId || null)) {
      return NextResponse.json(
        { error: 'O comercial informado já é o responsável atual.' },
        { status: 400 }
      );
    }

    // Atualiza o lead — mantém assigned_to em sincronia com comercial_id
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        comercial_id: comercialId || null,
        assigned_to: comercialId || null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('[Change Comercial] Update error:', updateError.message);
      return NextResponse.json({ error: `Erro ao alterar comercial: ${updateError.message}` }, { status: 500 });
    }

    // Auditoria completa
    const adminName = requester?.full_name || requester?.email || user.id;
    const newName = newComercial ? (newComercial.full_name || newComercial.email) : 'Nenhum';
    const description =
      `Comercial do lead "${lead.title}" alterado de "${previousName}" para "${newName}" ` +
      `por ${adminName}${reason ? ` — Motivo: ${reason}` : ''}`;

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'alteracao_comercial',
      entity_type: 'lead',
      entity_id: leadId,
      entity_name: lead.title,
      description,
      old_value: previousName,
      new_value: newName,
    });

    console.log(`[Change Comercial] Lead ${leadId}: "${previousName}" -> "${newName}" (admin: ${adminName})`);

    return NextResponse.json({
      success: true,
      message: 'Comercial alterado com sucesso',
      comercial: newComercial,
    });
  } catch (error) {
    console.error('[Change Comercial] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
