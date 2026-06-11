import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_STAGE_RATES: Record<string, number> = {
  backlog: 0,
  em_contato: 0,
  em_negociacao: 5,
  negociacao_fechada: 20,
  lead_nao_qualificado: 0,
  prospeccao_futura: 0,
};

/**
 * POST: Create a commission when a lead is won (negociacao_fechada).
 * Uses the service-role client to bypass RLS on the commissions table.
 * Any authenticated user can trigger it (the commission is attributed to the
 * lead's assigned user). Idempotent per lead: avoids duplicate commissions.
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { leadId, stage } = body;
    let { userId, dealValue } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId é obrigatório' }, { status: 400 });
    }
    if (stage !== 'negociacao_fechada') {
      return NextResponse.json({ error: 'Comissão só é gerada em negociacao_fechada' }, { status: 400 });
    }

    // Resolve the lead to fill in missing data (assigned user, value/custom_value)
    const { data: lead } = await supabase
      .from('leads')
      .select('id, assigned_to, value, custom_value, title')
      .eq('id', leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    // The commission belongs to the assigned user; fall back to the lead owner,
    // then to whoever triggered the action.
    const beneficiary = userId || lead.assigned_to || user.id;
    // Deal value: explicit > custom_value > value
    const value = Number(dealValue ?? lead.custom_value ?? lead.value ?? 0);

    if (!beneficiary) {
      return NextResponse.json({ error: 'Lead sem responsável (assigned_to) para atribuir comissão' }, { status: 400 });
    }
    if (!value || value <= 0) {
      return NextResponse.json({ error: 'Valor do negócio inválido para cálculo de comissão' }, { status: 400 });
    }

    // Idempotency: don't create a second commission for the same lead+user
    const { data: existing } = await supabase
      .from('commissions')
      .select('id')
      .eq('lead_id', leadId)
      .eq('user_id', beneficiary)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, commission: existing, alreadyExists: true });
    }

    // Resolve the commission rate: commission_config (user+stage) > user.commission_rate > default
    let rate = DEFAULT_STAGE_RATES[stage] ?? 0;
    const { data: config } = await supabase
      .from('commission_config')
      .select('percentage')
      .eq('user_id', beneficiary)
      .eq('stage', stage)
      .maybeSingle();
    if (config && config.percentage != null) {
      rate = Number(config.percentage);
    } else {
      const { data: u } = await supabase
        .from('users')
        .select('commission_rate')
        .eq('id', beneficiary)
        .maybeSingle();
      if (u && u.commission_rate != null && Number(u.commission_rate) > 0) {
        rate = Number(u.commission_rate);
      }
    }

    const amount = (value * rate) / 100;

    const { data: commission, error: insertError } = await supabase
      .from('commissions')
      .insert({
        lead_id: leadId,
        user_id: beneficiary,
        amount,
        percentage: rate,
        currency: 'BRL',
        status: 'pending',
        calculation_method: 'percentage',
        notes: `Comissão de ${rate}% sobre ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} (${lead.title || leadId})`,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Commissions Create] Insert error:', insertError.message);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update the beneficiary's monthly commission total (current month, pending)
    try {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data: monthComms } = await supabase
        .from('commissions')
        .select('amount')
        .eq('user_id', beneficiary)
        .eq('status', 'pending')
        .gte('created_at', monthStart);
      const total = (monthComms || []).reduce((s: number, c: { amount: number | null }) => s + (Number(c.amount) || 0), 0);
      await supabase.from('users').update({ monthly_commission_total: total }).eq('id', beneficiary);
    } catch (e) {
      console.error('[Commissions Create] monthly total update failed:', e);
    }

    return NextResponse.json({ success: true, commission });
  } catch (error) {
    console.error('[Commissions Create] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
