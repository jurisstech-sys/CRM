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
  [key: string]: any;
}

// Validar variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

// Criar cliente Supabase com service role key
const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: {
    persistSession: false,
  },
});

interface ImportRequestBody {
  leads: IncomingLead[];
  fileName: string;
}

export async function POST(request: NextRequest) {
  try {
    const { leads, fileName } = await request.json() as ImportRequestBody;

    // Validar entrada
    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lead foi fornecido' },
        { status: 400 }
      );
    }

    // Limite de 1000 leads por requisição
    if (leads.length > 1000) {
      return NextResponse.json(
        { error: 'Máximo de 1000 leads por requisição' },
        { status: 400 }
      );
    }

    // Preparar dados para inserção
    const leadsToInsert = leads
      .filter(lead => {
        // Apenas validar se tem NOME (obrigatório)
        return lead.nome;
      })
      .map(lead => ({
        nome: String(lead.nome || '').trim(),
        celular1: String(lead.celular1 || '').trim(),
        celular2: String(lead.celular2 || '').trim(),
        email1: String(lead.email1 || '').trim(),
        email2: String(lead.email2 || '').trim(),
        email3: String(lead.email3 || '').trim(),
        status: 'novo', // Status padrão
        criado_em: new Date().toISOString(),
        arquivo_origem: fileName || 'importacao',
        // Adicionar qualquer outro campo que venha no lead
        ...Object.fromEntries(
          Object.entries(lead)
            .filter(([key]) => !['nome', 'celular1', 'celular2', 'email1', 'email2', 'email3'].includes(key))
            .map(([key, value]) => [key, value])
        ),
      }));

    if (leadsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lead válido após filtragem' },
        { status: 400 }
      );
    }

    console.log(`[Leads Import] Iniciando importação de ${leadsToInsert.length} leads...`);

    // Inserir em batch no Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert(leadsToInsert)
      .select('id');

    if (error) {
      console.error('[Leads Import] Erro ao inserir leads:', error);
      return NextResponse.json(
        {
          error: `Erro ao salvar leads no banco de dados: ${error.message}`,
          details: error.details,
        },
        { status: 500 }
      );
    }

    const insertedCount = data?.length || 0;

    console.log(
      `[Leads Import] ✅ ${insertedCount} leads importados com sucesso`
    );

    return NextResponse.json(
      {
        success: true,
        count: insertedCount,
        message: `${insertedCount} leads importados com sucesso`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Leads Import] Erro na importação:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        error: `Erro ao processar requisição: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}