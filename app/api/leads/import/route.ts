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

interface ExistingLead {
  id: string;
  title: string;
  description: string | null;
  source: string | null;
  value: number | null;
  currency: string | null;
  status: string | null;
  probability: number | null;
  client_id: string | null;
  created_by: string | null;
  updated_by: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Merge new contact data into existing lead description.
 * Only adds phones/emails that are NOT already present in the description.
 */
function mergeLeadDescription(
  existingDescription: string | null,
  newPhones: (string | null)[],
  newEmails: (string | null)[]
): { merged: string; changed: boolean } {
  const current = existingDescription || '';
  let merged = current;
  let changed = false;

  for (const phone of newPhones) {
    if (phone && phone.trim() && !current.includes(phone.trim())) {
      if (merged.length > 0 && !merged.endsWith(' | ')) {
        merged += ' | ';
      }
      merged += `📱 Tel: ${phone.trim()}`;
      changed = true;
    }
  }

  for (const email of newEmails) {
    if (email && email.trim() && !current.includes(email.trim())) {
      if (merged.length > 0 && !merged.endsWith(' | ')) {
        merged += ' | ';
      }
      merged += `📧 Email: ${email.trim()}`;
      changed = true;
    }
  }

  return { merged, changed };
}

/**
 * Ensure the leads table status constraint allows new pipeline stages.
 * Drops old CHECK constraint and adds new one if needed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureStatusConstraint(supabase: any) {
  try {
    // Try to drop the old restrictive CHECK constraint
    // We use rpc exec_sql if available, otherwise we try inserting a test and if it fails we know
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
        ALTER TABLE leads ADD CONSTRAINT leads_status_check 
          CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura'));
      `
    });
    if (!rpcError) {
      console.log('[Leads Import] ✅ Status constraint atualizado via exec_sql');
      return;
    }
    console.log('[Leads Import] exec_sql não disponível, tentando via pg...');
  } catch {
    // exec_sql function doesn't exist, try direct pg
  }

  // Try via DATABASE_URL with pg
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: databaseUrl });
      await pool.query(`
        ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
        ALTER TABLE leads ADD CONSTRAINT leads_status_check 
          CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura'));
      `);
      await pool.end();
      console.log('[Leads Import] ✅ Status constraint atualizado via pg');
      return;
    } catch (pgErr) {
      console.error('[Leads Import] Erro ao atualizar constraint via pg:', pgErr);
    }
  }

  console.warn('[Leads Import] ⚠️ Não foi possível atualizar status constraint automaticamente');
}

/**
 * Ensure the imported_leads table exists.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureImportedLeadsTable(supabase: any) {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS imported_leads (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nome TEXT NOT NULL,
      celular1 TEXT,
      celular2 TEXT,
      email1 TEXT,
      email2 TEXT,
      email3 TEXT,
      status TEXT DEFAULT 'backlog',
      arquivo_origem TEXT,
      imported_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Try rpc first
  try {
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: createSQL });
    if (!rpcError) {
      console.log('[Leads Import] ✅ imported_leads table verified via exec_sql');
      return true;
    }
  } catch {
    // exec_sql not available
  }

  // Try via pg
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: databaseUrl });
      await pool.query(createSQL);
      await pool.end();
      console.log('[Leads Import] ✅ imported_leads table verified via pg');
      return true;
    } catch (pgErr) {
      console.error('[Leads Import] Erro ao criar imported_leads via pg:', pgErr);
    }
  }

  // As last resort, try inserting — if table doesn't exist, we'll skip it
  console.warn('[Leads Import] ⚠️ Não foi possível verificar imported_leads, continuando sem ela');
  return false;
}

/**
 * Remove UNIQUE constraint from client_id on leads table if it exists.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fixClientIdConstraint(supabase: any) {
  const sql = `
    ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_client_id_key;
  `;

  try {
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (!rpcError) {
      console.log('[Leads Import] ✅ client_id UNIQUE constraint removido via exec_sql');
      return;
    }
  } catch {
    // try pg
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: databaseUrl });
      await pool.query(sql);
      await pool.end();
      console.log('[Leads Import] ✅ client_id UNIQUE constraint removido via pg');
    } catch (pgErr) {
      console.error('[Leads Import] Erro ao remover constraint client_id:', pgErr);
    }
  }
}

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

    // Criar cliente Supabase com ANON KEY para verificar autenticação
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Verificar se o usuário é válido
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      console.error('[Leads Import] Usuário inválido:', userError?.message);
      return NextResponse.json(
        { error: 'Sessão inválida. Faça login novamente.' },
        { status: 401 }
      );
    }
    console.log('[Leads Import] Usuário autenticado:', user.id, user.email);

    // Criar cliente Supabase com SERVICE_ROLE_KEY para BYPASS de RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ============================================================
    // FIX DATABASE SCHEMA ISSUES BEFORE IMPORT
    // ============================================================
    console.log('[Leads Import] 🔧 Verificando e corrigindo schema...');
    await ensureStatusConstraint(supabase);
    await fixClientIdConstraint(supabase);
    const hasImportedLeadsTable = await ensureImportedLeadsTable(supabase);

    // Parse do body
    const body = await request.json() as ImportRequestBody;
    const { leads, fileName } = body;

    console.log('[Leads Import] 📁 Dados recebidos:', {
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

    // Limite de 5000 leads por requisição
    if (leads.length > 5000) {
      return NextResponse.json(
        { error: 'Máximo de 5000 leads por requisição' },
        { status: 400 }
      );
    }

    // Preparar dados para inserção
    const leadsToInsert = leads
      .filter(lead => {
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
        status: 'backlog',
        arquivo_origem: fileName || 'importacao',
        imported_by: user.id,
      }));

    console.log('[Leads Import] 📊 Leads válidos após filtragem:', leadsToInsert.length);

    if (leadsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lead válido após filtragem (todos sem nome?)' },
        { status: 400 }
      );
    }

    // ============================================================
    // STEP 1: Insert into imported_leads (historical table) — optional
    // ============================================================
    if (hasImportedLeadsTable) {
      const BATCH_SIZE = 500;
      let totalInserted = 0;

      for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
        const batch = leadsToInsert.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from('imported_leads')
          .insert(batch)
          .select('id');

        if (error) {
          console.error(`[Leads Import] Erro batch imported_leads:`, error.message);
        } else {
          totalInserted += data?.length || 0;
        }
      }
      console.log(`[Leads Import] imported_leads inseridos: ${totalInserted}`);
    } else {
      console.log('[Leads Import] ⏭️ Pulando imported_leads (tabela não disponível)');
    }

    // ============================================================
    // STEP 2: Ensure user exists in 'users' table (FK constraint)
    // ============================================================
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingUser) {
      console.log('[Leads Import] Criando registro de usuário...');
      const { error: createUserError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || '',
          role: 'user',
          status: 'active',
        });

      if (createUserError) {
        console.error('[Leads Import] Erro ao criar usuário:', createUserError.message);
      }
    }

    // ============================================================
    // STEP 3: ANTI-DUPLICAÇÃO — fetch existing leads + clients
    // ============================================================
    console.log('[Leads Import] 🔍 Verificando duplicatas...');

    const incomingNames = leadsToInsert.map(l => l.nome);
    const incomingEmails = leadsToInsert
      .flatMap(l => [l.email1, l.email2, l.email3])
      .filter((e): e is string => !!e);

    const existingLeadsMap = new Map<string, ExistingLead>();
    const existingClientsByName = new Map<string, { id: string; email: string | null; phone: string | null }>();

    // Fetch existing leads by title (name)
    const uniqueNames = [...new Set(incomingNames)];
    for (let i = 0; i < uniqueNames.length; i += 100) {
      const nameBatch = uniqueNames.slice(i, i + 100);
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('id, title, description, source, value, currency, status, probability, client_id, created_by, updated_by')
        .in('title', nameBatch);

      if (existingLeads) {
        for (const lead of existingLeads) {
          existingLeadsMap.set(lead.title.toLowerCase(), lead as ExistingLead);
        }
      }
    }

    // Check by email in description
    if (incomingEmails.length > 0) {
      const uniqueEmails = [...new Set(incomingEmails)].slice(0, 200); // limit lookups
      for (const email of uniqueEmails) {
        const { data: emailLeads } = await supabase
          .from('leads')
          .select('id, title, description, source, value, currency, status, probability, client_id, created_by, updated_by')
          .ilike('description', `%${email}%`)
          .limit(1);

        if (emailLeads && emailLeads.length > 0) {
          const lead = emailLeads[0];
          if (!existingLeadsMap.has(lead.title.toLowerCase())) {
            existingLeadsMap.set(lead.title.toLowerCase(), lead as ExistingLead);
          }
        }
      }
    }

    // Fetch existing clients by name
    for (let i = 0; i < uniqueNames.length; i += 100) {
      const nameBatch = uniqueNames.slice(i, i + 100);
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .in('name', nameBatch);

      if (existingClients) {
        for (const client of existingClients) {
          existingClientsByName.set(client.name.toLowerCase(), {
            id: client.id,
            email: client.email,
            phone: client.phone,
          });
        }
      }
    }

    console.log(`[Leads Import] 📊 Leads existentes: ${existingLeadsMap.size}`);
    console.log(`[Leads Import] 📊 Clientes existentes: ${existingClientsByName.size}`);

    // ============================================================
    // STEP 4: PROCESS EACH LEAD — create new OR merge existing
    // ============================================================
    let statsNewLeads = 0;
    let statsUpdatedLeads = 0;
    let statsIgnoredLeads = 0;
    let statsNewClients = 0;
    let statsUpdatedClients = 0;
    let statsErrors = 0;
    const pipelineErrors: string[] = [];
    const clientIdMap: Record<string, string> = {};

    for (const lead of leadsToInsert) {
      const nameKey = lead.nome.toLowerCase();
      const phones = [lead.celular1, lead.celular2].filter(Boolean) as string[];
      const emails = [lead.email1, lead.email2, lead.email3].filter(Boolean) as string[];

      // ---- CLIENTS TABLE ----
      const existingClient = existingClientsByName.get(nameKey);
      if (existingClient) {
        clientIdMap[lead.nome] = existingClient.id;
        // Merge client data if email/phone missing
        const updates: { email?: string; phone?: string } = {};
        let hasChanges = false;
        if (!existingClient.email && lead.email1 && lead.email1.trim()) {
          updates.email = lead.email1.trim();
          hasChanges = true;
        }
        if (!existingClient.phone && lead.celular1 && lead.celular1.trim()) {
          updates.phone = lead.celular1.trim();
          hasChanges = true;
        }

        if (hasChanges) {
          const { error: updateErr } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', existingClient.id);

          if (!updateErr) {
            statsUpdatedClients++;
            if (updates.email) existingClient.email = updates.email;
            if (updates.phone) existingClient.phone = updates.phone;
          }
        }
      } else {
        // Create new client
        const { data: newClient, error: clientErr } = await supabase
          .from('clients')
          .insert({
            name: lead.nome,
            email: lead.email1 || null,
            phone: lead.celular1 || null,
            status: 'active',
            created_by: user.id,
          })
          .select('id, name')
          .single();

        if (clientErr) {
          console.error(`[Leads Import] Erro ao criar cliente ${lead.nome}:`, clientErr.message);
        } else if (newClient) {
          statsNewClients++;
          clientIdMap[lead.nome] = newClient.id;
          existingClientsByName.set(nameKey, {
            id: newClient.id,
            email: lead.email1 || null,
            phone: lead.celular1 || null,
          });
        }
      }

      // ---- LEADS (PIPELINE) TABLE ----
      const existingLead = existingLeadsMap.get(nameKey);
      if (existingLead) {
        // Lead already exists — merge new contact data
        const { merged, changed } = mergeLeadDescription(
          existingLead.description,
          [lead.celular1, lead.celular2],
          [lead.email1, lead.email2, lead.email3]
        );

        if (changed) {
          const updateData: Record<string, unknown> = {
            description: merged,
            updated_by: user.id,
          };

          if (!existingLead.client_id && clientIdMap[lead.nome]) {
            updateData.client_id = clientIdMap[lead.nome];
          }

          const { error: updateErr } = await supabase
            .from('leads')
            .update(updateData)
            .eq('id', existingLead.id);

          if (updateErr) {
            console.error(`[Leads Import] Erro ao atualizar lead ${lead.nome}:`, updateErr.message);
            pipelineErrors.push(`Update ${lead.nome}: ${updateErr.message}`);
            statsErrors++;
          } else {
            statsUpdatedLeads++;
            existingLead.description = merged;
          }
        } else {
          statsIgnoredLeads++;
        }
      } else {
        // New lead — create it
        const contactParts: string[] = [];
        if (phones.length > 0) {
          contactParts.push(`📱 Tel: ${phones.join(', ')}`);
        }
        if (emails.length > 0) {
          contactParts.push(`📧 Email: ${emails.join(', ')}`);
        }
        const description = contactParts.length > 0
          ? contactParts.join(' | ')
          : `Importado de: ${lead.arquivo_origem}`;

        // Use client_id only if we have one, but be careful with UNIQUE constraint
        const resolvedClientId = clientIdMap[lead.nome] || null;

        const insertData: Record<string, unknown> = {
          title: lead.nome,
          description,
          source: 'importacao',
          value: 0,
          currency: 'BRL',
          status: 'backlog',
          probability: 0,
          email1: lead.email1 || null,
          email2: lead.email2 || null,
          email3: lead.email3 || null,
          phone1: lead.celular1 || null,
          phone2: lead.celular2 || null,
          created_by: user.id,
          updated_by: user.id,
        };

        // Only set client_id if we're confident it won't violate UNIQUE
        // Check if there's already a lead with this client_id
        if (resolvedClientId) {
          const existingLeadWithClient = Array.from(existingLeadsMap.values()).find(
            l => l.client_id === resolvedClientId
          );
          if (!existingLeadWithClient) {
            insertData.client_id = resolvedClientId;
          }
        }

        const { data: newLead, error: pError } = await supabase
          .from('leads')
          .insert(insertData)
          .select('id, title')
          .single();

        if (pError) {
          console.error(`[Leads Import] ❌ Erro ao criar lead "${lead.nome}":`, pError.message, pError.code, pError.details);
          
          // If error is about status constraint, try with 'new' status as fallback
          if (pError.message.includes('leads_status_check') || pError.message.includes('check constraint')) {
            console.log(`[Leads Import] Tentando com status 'new' como fallback...`);
            insertData.status = 'new';
            const { data: retryLead, error: retryErr } = await supabase
              .from('leads')
              .insert(insertData)
              .select('id, title')
              .single();

            if (retryErr) {
              pipelineErrors.push(`Create ${lead.nome}: ${retryErr.message}`);
              statsErrors++;
            } else if (retryLead) {
              statsNewLeads++;
              existingLeadsMap.set(nameKey, {
                id: retryLead.id,
                title: retryLead.title,
                description,
                source: 'importacao',
                value: 0,
                currency: 'BRL',
                status: 'new',
                probability: 0,
                client_id: (insertData.client_id as string) || null,
                created_by: user.id,
                updated_by: user.id,
              });
            }
          } else if (pError.message.includes('client_id') || pError.code === '23505') {
            // UNIQUE violation on client_id — retry without client_id
            console.log(`[Leads Import] Tentando sem client_id...`);
            delete insertData.client_id;
            const { data: retryLead, error: retryErr } = await supabase
              .from('leads')
              .insert(insertData)
              .select('id, title')
              .single();

            if (retryErr) {
              pipelineErrors.push(`Create ${lead.nome}: ${retryErr.message}`);
              statsErrors++;
            } else if (retryLead) {
              statsNewLeads++;
              existingLeadsMap.set(nameKey, {
                id: retryLead.id,
                title: retryLead.title,
                description,
                source: 'importacao',
                value: 0,
                currency: 'BRL',
                status: 'backlog',
                probability: 0,
                client_id: null,
                created_by: user.id,
                updated_by: user.id,
              });
            }
          } else {
            pipelineErrors.push(`Create ${lead.nome}: ${pError.message}`);
            statsErrors++;
          }
        } else if (newLead) {
          statsNewLeads++;
          existingLeadsMap.set(nameKey, {
            id: newLead.id,
            title: newLead.title,
            description,
            source: 'importacao',
            value: 0,
            currency: 'BRL',
            status: 'backlog',
            probability: 0,
            client_id: (insertData.client_id as string) || null,
            created_by: user.id,
            updated_by: user.id,
          });
        }
      }
    }

    console.log(`[Leads Import] ====== ESTATÍSTICAS FINAIS ======`);
    console.log(`[Leads Import] ✅ Novos leads criados: ${statsNewLeads}`);
    console.log(`[Leads Import] 🔄 Leads atualizados (merge): ${statsUpdatedLeads}`);
    console.log(`[Leads Import] ⏭️  Leads ignorados (sem novos dados): ${statsIgnoredLeads}`);
    console.log(`[Leads Import] 👤 Novos clientes criados: ${statsNewClients}`);
    console.log(`[Leads Import] 🔄 Clientes atualizados: ${statsUpdatedClients}`);
    console.log(`[Leads Import] ❌ Erros: ${statsErrors}`);
    if (pipelineErrors.length > 0) {
      console.log(`[Leads Import] Primeiros erros:`, pipelineErrors.slice(0, 5));
    }

    const totalProcessed = statsNewLeads + statsUpdatedLeads + statsIgnoredLeads;

    if (statsNewLeads === 0 && statsUpdatedLeads === 0 && totalProcessed === 0) {
      return NextResponse.json(
        {
          error: `Erro ao salvar leads: ${pipelineErrors.slice(0, 3).join('; ')}`,
          details: pipelineErrors.slice(0, 10),
          stats: {
            newLeads: statsNewLeads,
            updatedLeads: statsUpdatedLeads,
            ignoredLeads: statsIgnoredLeads,
            errors: statsErrors,
          },
        },
        { status: 500 }
      );
    }

    // Build descriptive message
    const messageParts: string[] = [];
    if (statsNewLeads > 0) messageParts.push(`${statsNewLeads} novos`);
    if (statsUpdatedLeads > 0) messageParts.push(`${statsUpdatedLeads} atualizados`);
    if (statsIgnoredLeads > 0) messageParts.push(`${statsIgnoredLeads} sem alteração`);
    if (statsErrors > 0) messageParts.push(`${statsErrors} com erro`);

    const message = `Importação concluída: ${messageParts.join(', ')}`;

    return NextResponse.json(
      {
        success: true,
        count: statsNewLeads + statsUpdatedLeads,
        pipelineCount: statsNewLeads + statsUpdatedLeads,
        total: leadsToInsert.length,
        stats: {
          newLeads: statsNewLeads,
          updatedLeads: statsUpdatedLeads,
          ignoredLeads: statsIgnoredLeads,
          newClients: statsNewClients,
          updatedClients: statsUpdatedClients,
          errors: statsErrors,
        },
        errors: pipelineErrors.length > 0 ? pipelineErrors.slice(0, 10) : undefined,
        message,
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
