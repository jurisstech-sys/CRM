import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Desativa o cache de fetch do Next.js para sempre retornar dados atualizados
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

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

    // Build query - use service role to bypass RLS
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const statuses = statusFilter ? statusFilter.split(',') : null;

    // Limite do "pool" de Backlog não atribuído (leads sem comercial). Como a base
    // pode ter centenas de milhares de leads no Backlog, carregamos apenas os mais
    // recentes desse pool para não travar o navegador. Configurável via ?backlogLimit.
    const backlogLimitParam = parseInt(searchParams.get('backlogLimit') || '', 10);
    const BACKLOG_LIMIT = Number.isFinite(backlogLimitParam) && backlogLimitParam > 0
      ? Math.min(backlogLimitParam, 5000)
      : 2000;

    const SELECT_COLS = '*, clients(name, email), comercialUser:users!leads_comercial_id_fkey(id, full_name, email)';

    // Supabase retorna no máximo 1000 linhas por requisição. Esta função pagina
    // com .range() para trazer TODAS as linhas que casam com o filtro.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchAll = async (buildQuery: () => any) => {
      const pageSize = 1000;
      let from = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all: any[] = [];
      // Loop até acabar as páginas
      // (leads em andamento/atribuídos são poucos milhares, então é seguro)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await buildQuery().range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
        // trava de segurança para evitar loops infinitos
        if (from > 200000) break;
      }
      return all;
    };

    // 1) LEADS EM ANDAMENTO / ATRIBUÍDOS — SEMPRE retornados por completo.
    //    Regra: tudo que NÃO seja "backlog sem comercial".
    //    Ou seja: status != 'backlog'  OU  comercial_id IS NOT NULL.
    //    Isso garante que nenhum lead que a equipe já está trabalhando desapareça
    //    após uma importação (o bug relatado).
    const workedLeads = await fetchAll(() => {
      let q = supabase
        .from('leads')
        .select(SELECT_COLS)
        .or('status.neq.backlog,comercial_id.not.is.null')
        .order('created_at', { ascending: false });
      if (statuses) q = q.in('status', statuses);
      return q;
    });

    // 2) POOL DO BACKLOG (sem comercial) — apenas os mais recentes (limitado).
    //    O Supabase limita cada requisição a 1000 linhas, então paginamos até
    //    atingir o BACKLOG_LIMIT configurado.
    let backlogLeads: typeof workedLeads = [];
    if (!statuses || statuses.includes('backlog')) {
      try {
        const pageSize = 1000;
        let from = 0;
        while (backlogLeads.length < BACKLOG_LIMIT) {
          const to = Math.min(from + pageSize - 1, BACKLOG_LIMIT - 1);
          const { data: pageData, error: backlogErr } = await supabase
            .from('leads')
            .select(SELECT_COLS)
            .eq('status', 'backlog')
            .is('comercial_id', null)
            .order('created_at', { ascending: false })
            .range(from, to);
          if (backlogErr) throw backlogErr;
          if (!pageData || pageData.length === 0) break;
          backlogLeads.push(...pageData);
          if (pageData.length < pageSize) break;
          from += pageSize;
        }
      } catch (backlogErr) {
        console.error('[Leads API] Backlog error:', backlogErr);
        return NextResponse.json(
          { error: backlogErr instanceof Error ? backlogErr.message : 'Erro ao carregar backlog' },
          { status: 500 }
        );
      }
    }

    // Merge + dedupe por id (por segurança, caso um lead caia nos dois conjuntos)
    const byId = new Map<string, (typeof workedLeads)[number]>();
    for (const l of workedLeads) byId.set(l.id, l);
    for (const l of backlogLeads) if (!byId.has(l.id)) byId.set(l.id, l);
    const data = Array.from(byId.values());

    // Contagem total do backlog não atribuído (para informar quando houver mais que o limite)
    const { count: backlogTotal } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'backlog')
      .is('comercial_id', null);

    console.log(`[Leads API] Retornando ${data.length} leads (andamento/atribuídos: ${workedLeads.length}, backlog exibido: ${backlogLeads.length}/${backlogTotal ?? '?'}) para ${user.email} (isAdmin: ${isAdmin})`);
    return NextResponse.json({
      leads: data,
      isAdmin,
      backlogTotal: backlogTotal ?? backlogLeads.length,
      backlogShown: backlogLeads.length,
    });
  } catch (error) {
    console.error('[Leads API] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PATCH: Update lead status (for drag-and-drop)
export async function PATCH(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Configuração incompleta' }, { status: 500 });
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

    // Use service role to bypass RLS for updates
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do lead é obrigatório' }, { status: 400 });
    }

    // Determina se o usuário é admin
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    const isAdmin = userRow?.role === 'admin' || userRow?.role === 'super_admin';

    // Regra de posse: se o lead já tem um comercial responsável diferente do usuário,
    // apenas um admin pode alterá-lo. Bloqueia acesso via API por outros comerciais.
    const { data: existingLead } = await supabase
      .from('leads')
      .select('comercial_id')
      .eq('id', id)
      .single();

    if (
      existingLead?.comercial_id &&
      existingLead.comercial_id !== user.id &&
      !isAdmin
    ) {
      return NextResponse.json(
        { error: 'Você não pode alterar este lead, pois ele pertence a outro comercial.' },
        { status: 403 }
      );
    }

    // Somente admin pode reatribuir o comercial de um lead que já possui dono.
    if (
      !isAdmin &&
      'comercial_id' in updates &&
      existingLead?.comercial_id &&
      updates.comercial_id !== existingLead.comercial_id
    ) {
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar o comercial responsável.' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', id);

    if (error) {
      console.error('[Leads API] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Leads API] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
