import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log('[Leads Import] ====== INÍCIO DA IMPORTAÇÃO ======');

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta (Supabase)' },
        { status: 500 }
      );
    }

    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Usuário não autenticado. Faça login novamente.' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Sessão inválida. Faça login novamente.' },
        { status: 401 }
      );
    }
    console.log('[Leads Import] Usuário autenticado:', user.id, user.email);

    // Service role client for RLS bypass
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse body
    const body = await request.json() as ImportRequestBody;
    const { leads, fileName } = body;

    console.log('[Leads Import] Dados recebidos:', {
      fileName,
      totalLeads: leads?.length,
      primeiroLead: leads?.[0],
    });

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'Nenhum lead foi fornecido' }, { status: 400 });
    }

    if (leads.length > 5000) {
      return NextResponse.json({ error: 'Máximo de 5000 leads por requisição' }, { status: 400 });
    }

    // Ensure user exists in users table (FK constraint)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingUser) {
      console.log('[Leads Import] Criando registro de usuário...');
      await supabase.from('users').insert({
        id: user.id,
        email: user.email || '',
        role: 'user',
        status: 'active',
      });
    }

    // Filter and prepare leads
    const leadsToInsert = leads
      .filter(lead => lead.nome && String(lead.nome).trim().length > 0)
      .map(lead => {
        const phones = [lead.celular1, lead.celular2].filter(p => p && String(p).trim()).map(p => String(p).trim());
        const emails = [lead.email1, lead.email2, lead.email3].filter(e => e && String(e).trim()).map(e => String(e).trim());

        const contactParts: string[] = [];
        if (phones.length > 0) contactParts.push(`📱 Tel: ${phones.join(', ')}`);
        if (emails.length > 0) contactParts.push(`📧 Email: ${emails.join(', ')}`);
        const description = contactParts.length > 0
          ? contactParts.join(' | ')
          : `Importado de: ${fileName || 'importacao'}`;

        return {
          title: String(lead.nome).trim(),
          description,
          source: 'importacao',
          value: 0,
          currency: 'BRL',
          status: 'backlog',
          probability: 0,
          email1: lead.email1 ? String(lead.email1).trim() : null,
          email2: lead.email2 ? String(lead.email2).trim() : null,
          email3: lead.email3 ? String(lead.email3).trim() : null,
          phone1: lead.celular1 ? String(lead.celular1).trim() : null,
          phone2: lead.celular2 ? String(lead.celular2).trim() : null,
          assigned_to: null,
          created_by: user.id,
          updated_by: user.id,
        };
      });

    console.log('[Leads Import] Leads válidos após filtragem:', leadsToInsert.length);

    if (leadsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lead válido após filtragem (todos sem nome?)' },
        { status: 400 }
      );
    }

    // Insert in batches of 500
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    let totalErrors = 0;
    const errors: string[] = [];

    for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
      const batch = leadsToInsert.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase
        .from('leads')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`[Leads Import] Erro batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
        errors.push(error.message);

        // If status constraint fails, try with fallback status 'new'
        if (error.message.includes('leads_status_check') || error.message.includes('check constraint')) {
          console.log('[Leads Import] Tentando com status "new" como fallback...');
          const fallbackBatch = batch.map(l => ({ ...l, status: 'new' }));
          const { data: retryData, error: retryErr } = await supabase
            .from('leads')
            .insert(fallbackBatch)
            .select('id');

          if (retryErr) {
            console.error('[Leads Import] Fallback também falhou:', retryErr.message);
            totalErrors += batch.length;
          } else {
            totalInserted += retryData?.length || 0;
          }
        } else {
          totalErrors += batch.length;
        }
      } else {
        totalInserted += data?.length || 0;
      }
    }

    console.log(`[Leads Import] ====== RESULTADO ======`);
    console.log(`[Leads Import] ✅ Inseridos: ${totalInserted}`);
    console.log(`[Leads Import] ❌ Erros: ${totalErrors}`);

    if (totalInserted === 0) {
      return NextResponse.json(
        {
          error: `Erro ao salvar leads: ${errors.slice(0, 3).join('; ')}`,
          details: errors.slice(0, 10),
        },
        { status: 500 }
      );
    }

    // Also create clients for the imported leads
    let clientsCreated = 0;
    try {
      const clientsToInsert = leadsToInsert.map(lead => ({
        name: lead.title,
        email: lead.email1 || null,
        phone: lead.phone1 || null,
        status: 'active',
        created_by: user.id,
      }));

      // Check existing clients first
      const names = [...new Set(clientsToInsert.map(c => c.name))];
      const { data: existingClients } = await supabase
        .from('clients')
        .select('name')
        .in('name', names.slice(0, 500));

      const existingNames = new Set((existingClients || []).map(c => c.name?.toLowerCase()));
      const newClients = clientsToInsert.filter(c => !existingNames.has(c.name.toLowerCase()));

      if (newClients.length > 0) {
        // Deduplicate by name
        const seen = new Set<string>();
        const uniqueClients = newClients.filter(c => {
          const key = c.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        for (let i = 0; i < uniqueClients.length; i += BATCH_SIZE) {
          const batch = uniqueClients.slice(i, i + BATCH_SIZE);
          const { data } = await supabase.from('clients').insert(batch).select('id');
          clientsCreated += data?.length || 0;
        }
      }
    } catch (clientErr) {
      console.error('[Leads Import] Erro ao criar clientes (não-crítico):', clientErr);
    }

    const messageParts: string[] = [];
    if (totalInserted > 0) messageParts.push(`${totalInserted} leads importados`);
    if (clientsCreated > 0) messageParts.push(`${clientsCreated} clientes criados`);
    if (totalErrors > 0) messageParts.push(`${totalErrors} com erro`);

    return NextResponse.json({
      success: true,
      count: totalInserted,
      pipelineCount: totalInserted,
      total: leadsToInsert.length,
      stats: {
        newLeads: totalInserted,
        newClients: clientsCreated,
        errors: totalErrors,
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      message: `Importação concluída: ${messageParts.join(', ')}`,
    });
  } catch (error) {
    console.error('[Leads Import] Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: `Erro ao processar requisição: ${errorMessage}` },
      { status: 500 }
    );
  }
}
