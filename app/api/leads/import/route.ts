import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Tipo de lead recebido da requisição
interface IncomingLead {
  nome: string;
  email: string;
  telefone: string;
  valor: number | string;
  fonte: string;
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
        // Validar campos obrigatórios
        return lead.nome && lead.email;
      })
      .map(lead => ({
        nome: String(lead.nome || '').trim(),
        email: String(lead.email || '').trim(),
        telefone: String(lead.telefone || '').trim(),
        valor: parseFloat(String(lead.valor || '0').replace(/[^\d.-]/g, '')) || 0,
        fonte: String(lead.fonte || '').trim(),
        status: 'novo', // Status padrão
        criado_em: new Date().toISOString(),
        arquivo_origem: fileName || 'importacao',
        // Adicionar qualquer outro campo que venha no lead
        ...Object.fromEntries(
          Object.entries(lead)
            .filter(([key]) => !['nome', 'email', 'telefone', 'valor', 'fonte'].includes(key))
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
