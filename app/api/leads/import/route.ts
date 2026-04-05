import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Tipo de lead recebido da requisição
interface IncomingLead {
  nome?: string;
  celular1?: string;
  celular2?: string;
  email1?: string;
  email2?: string;
  email3?: string;
  [key: string]: unknown;
}

interface ImportRequestBody {
  leads: IncomingLead[];
  fileName: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log('[Leads Import] ====== INÍCIO DA IMPORTAÇÃO ======');

    // Verificar variáveis de ambiente
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Leads Import] Variáveis de ambiente Supabase não configuradas');
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta (Supabase)' },
        { status: 500 }
      );
    }

    // Extrair token de autenticação do header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Leads Import] Token de autenticação não fornecido');
      return NextResponse.json(
        { error: 'Usuário não autenticado. Faça login novamente.' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // Criar cliente Supabase com o token do usuário autenticado
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Verificar se o usuário é válido
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      console.error('[Leads Import] Usuário inválido:', userError?.message);
      return NextResponse.json(
        { error: 'Sessão inválida. Faça login novamente.' },
        { status: 401 }
      );
    }
    console.log('[Leads Import] Usuário autenticado:', user.id, user.email);

    // Parse do body
    const body = await request.json() as ImportRequestBody;
    const { leads, fileName } = body;

    console.log('[Leads Import] Dados recebidos:', {
      fileName,
      totalLeads: leads?.length,
      primeiroLead: leads?.[0],
    });

    // Validar entrada
    if (!Array.isArray(leads) || leads.length === 0) {
      console.error('[Leads Import] Nenhum lead fornecido');
      return NextResponse.json(
        { error: 'Nenhum lead foi fornecido' },
        { status: 400 }
      );
    }

    // Limite de 5000 leads por requisição (arquivo grande)
    if (leads.length > 5000) {
      return NextResponse.json(
        { error: 'Máximo de 5000 leads por requisição' },
        { status: 400 }
      );
    }

    // Preparar dados para inserção na tabela imported_leads
    const leadsToInsert = leads
      .filter(lead => {
        // Apenas validar se tem NOME (obrigatório)
        const hasName = lead.nome && String(lead.nome).trim().length > 0;
        return hasName;
      })
      .map(lead => ({
        nome: String(lead.nome || '').trim(),
        celular1: String(lead.celular1 || '').trim() || null,
        celular2: String(lead.celular2 || '').trim() || null,
        email1: String(lead.email1 || '').trim() || null,
        email2: String(lead.email2 || '').trim() || null,
        email3: String(lead.email3 || '').trim() || null,
        status: 'novo',
        arquivo_origem: fileName || 'importacao',
        imported_by: user.id,
      }));

    console.log('[Leads Import] Quantidade de leads válidos:', leadsToInsert.length);

    if (leadsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lead válido após filtragem (todos sem nome?)' },
        { status: 400 }
      );
    }

    // Inserir em batches de 500 para evitar timeout
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
      const batch = leadsToInsert.slice(i, i + BATCH_SIZE);
      console.log(`[Leads Import] Inserindo batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} leads...`);

      const { data, error } = await supabase
        .from('imported_leads')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`[Leads Import] Erro no batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message, error.details, error.hint);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        const count = data?.length || 0;
        totalInserted += count;
        console.log(`[Leads Import] ✅ Batch inserido: ${count} leads`);
      }
    }

    console.log(`[Leads Import] ====== FIM DA IMPORTAÇÃO ======`);
    console.log(`[Leads Import] Total inserido: ${totalInserted}/${leadsToInsert.length}`);

    if (totalInserted === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          error: `Erro ao salvar leads: ${errors.join('; ')}`,
          details: errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        count: totalInserted,
        total: leadsToInsert.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `${totalInserted} leads importados com sucesso${errors.length > 0 ? ` (${errors.length} erros)` : ''}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Leads Import] Erro geral na importação:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        error: `Erro ao processar requisição: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
