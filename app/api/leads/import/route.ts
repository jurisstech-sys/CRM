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

  // Merge phones
  for (const phone of newPhones) {
    if (phone && phone.trim() && !current.includes(phone.trim())) {
      if (merged.length > 0 && !merged.endsWith(' | ')) {
        merged += ' | ';
      }
      merged += `📱 Tel: ${phone.trim()}`;
      changed = true;
    }
  }

  // Merge emails
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
 * Merge new contact data into existing client record.
 * Returns updated fields if changes are needed, null otherwise.
 */
function mergeClientData(
  existingEmail: string | null,
  existingPhone: string | null,
  newEmail: string | null,
  newPhone: string | null
): { email?: string; phone?: string } | null {
  const updates: { email?: string; phone?: string } = {};
  let hasChanges = false;

  if (!existingEmail && newEmail && newEmail.trim()) {
    updates.email = newEmail.trim();
    hasChanges = true;
  }

  if (!existingPhone && newPhone && newPhone.trim()) {
    updates.phone = newPhone.trim();
    hasChanges = true;
  }

  return hasChanges ? updates : null;
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

    // Criar cliente Supabase com SERVICE_ROLE_KEY para BYPASS de RLS nas inserções
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    // Inserir em imported_leads (tabela de histórico — sempre insere)
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
      const batch = leadsToInsert.slice(i, i + BATCH_SIZE);
      console.log(`[Leads Import] Inserindo batch imported_leads ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} leads...`);

      const { data, error } = await supabase
        .from('imported_leads')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`[Leads Import] Erro no batch imported_leads ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message, error.details, error.hint);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        const count = data?.length || 0;
        totalInserted += count;
        console.log(`[Leads Import] ✅ Batch imported_leads inserido: ${count} leads`);
      }
    }

    console.log(`[Leads Import] ====== FIM DA IMPORTAÇÃO (imported_leads) ======`);
    console.log(`[Leads Import] Total inserido em imported_leads: ${totalInserted}/${leadsToInsert.length}`);

    // ============================================================
    // Ensure the user exists in 'users' table (FK constraint)
    // ============================================================
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingUser) {
      console.log('[Leads Import] Usuário não encontrado na tabela users, criando registro...');
      const { error: createUserError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || '',
          role: 'user',
          status: 'active',
        });

      if (createUserError) {
        console.error('[Leads Import] Erro ao criar usuário na tabela users:', createUserError.message);
      } else {
        console.log('[Leads Import] ✅ Registro de usuário criado na tabela users');
      }
    }

    // ============================================================
    // ANTI-DUPLICAÇÃO INTELIGENTE
    // Fetch ALL existing leads and clients to detect duplicates
    // ============================================================
    console.log('[Leads Import] 🔍 Verificando duplicatas...');

    // Collect all names and emails from incoming leads for lookup
    const incomingNames = leadsToInsert.map(l => l.nome);
    const incomingEmails = leadsToInsert
      .flatMap(l => [l.email1, l.email2, l.email3])
      .filter((e): e is string => !!e);

    // Fetch existing leads by title (name)
    const existingLeadsMap = new Map<string, ExistingLead>();
    const existingClientsByName = new Map<string, { id: string; email: string | null; phone: string | null }>();

    // Fetch existing leads in batches (Supabase has query limits)
    const uniqueNames = [...new Set(incomingNames)];
    for (let i = 0; i < uniqueNames.length; i += 100) {
      const nameBatch = uniqueNames.slice(i, i + 100);
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('id, title, description, source, value, currency, status, probability, client_id, created_by, updated_by')
        .in('title', nameBatch);

      if (existingLeads) {
        for (const lead of existingLeads) {
          // Store by lowercase title for case-insensitive matching
          existingLeadsMap.set(lead.title.toLowerCase(), lead as ExistingLead);
        }
      }
    }

    // Also check by email in description for more robust dedup
    if (incomingEmails.length > 0) {
      for (let i = 0; i < incomingEmails.length; i += 50) {
        const emailBatch = incomingEmails.slice(i, i + 50);
        for (const email of emailBatch) {
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

    console.log(`[Leads Import] 📊 Leads existentes encontrados: ${existingLeadsMap.size}`);
    console.log(`[Leads Import] 📊 Clientes existentes encontrados: ${existingClientsByName.size}`);

    // ============================================================
    // PROCESS EACH LEAD: Create new OR Merge into existing
    // ============================================================
    let statsNewLeads = 0;
    let statsUpdatedLeads = 0;
    let statsIgnoredLeads = 0;
    let statsNewClients = 0;
    let statsUpdatedClients = 0;
    const pipelineErrors: string[] = [];
    const clientIdMap: Record<string, string> = {};

    for (const lead of leadsToInsert) {
      const nameKey = lead.nome.toLowerCase();
      const phones = [lead.celular1, lead.celular2].filter(Boolean) as string[];
      const emails = [lead.email1, lead.email2, lead.email3].filter(Boolean) as string[];

      // ---- CLIENTS TABLE ----
      const existingClient = existingClientsByName.get(nameKey);
      if (existingClient) {
        // Merge client data if needed
        clientIdMap[lead.nome] = existingClient.id;
        const clientUpdates = mergeClientData(
          existingClient.email,
          existingClient.phone,
          lead.email1,
          lead.celular1
        );

        if (clientUpdates) {
          const { error: updateErr } = await supabase
            .from('clients')
            .update(clientUpdates)
            .eq('id', existingClient.id);

          if (updateErr) {
            console.error(`[Leads Import] Erro ao atualizar cliente ${lead.nome}:`, updateErr.message);
          } else {
            statsUpdatedClients++;
            // Update local cache
            if (clientUpdates.email) existingClient.email = clientUpdates.email;
            if (clientUpdates.phone) existingClient.phone = clientUpdates.phone;
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

          // Also update client_id if existing lead has none but we now have one
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
          } else {
            statsUpdatedLeads++;
            // Update local cache to avoid duplicate merges for same-name leads
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

        const { data: newLead, error: pError } = await supabase
          .from('leads')
          .insert({
            title: lead.nome,
            description,
            source: 'importacao',
            value: 0,
            currency: 'BRL',
            status: 'new',
            probability: 0,
            client_id: clientIdMap[lead.nome] || null,
            email1: lead.email1 || null,
            email2: lead.email2 || null,
            email3: lead.email3 || null,
            phone1: lead.celular1 || null,
            phone2: lead.celular2 || null,
            created_by: user.id,
            updated_by: user.id,
          })
          .select('id, title')
          .single();

        if (pError) {
          console.error(`[Leads Import] Erro ao criar lead ${lead.nome}:`, pError.message);
          pipelineErrors.push(`Create ${lead.nome}: ${pError.message}`);
        } else if (newLead) {
          statsNewLeads++;
          // Add to cache so subsequent same-name leads in this batch are detected
          existingLeadsMap.set(nameKey, {
            id: newLead.id,
            title: newLead.title,
            description,
            source: 'importacao',
            value: 0,
            currency: 'BRL',
            status: 'new',
            probability: 0,
            client_id: clientIdMap[lead.nome] || null,
            created_by: user.id,
            updated_by: user.id,
          });
        }
      }
    }

    console.log(`[Leads Import] ====== ESTATÍSTICAS ANTI-DUPLICAÇÃO ======`);
    console.log(`[Leads Import] ✅ Novos leads criados: ${statsNewLeads}`);
    console.log(`[Leads Import] 🔄 Leads atualizados (merge): ${statsUpdatedLeads}`);
    console.log(`[Leads Import] ⏭️  Leads ignorados (sem novos dados): ${statsIgnoredLeads}`);
    console.log(`[Leads Import] 👤 Novos clientes criados: ${statsNewClients}`);
    console.log(`[Leads Import] 🔄 Clientes atualizados: ${statsUpdatedClients}`);

    const totalProcessed = statsNewLeads + statsUpdatedLeads + statsIgnoredLeads;
    const allErrors = [...errors, ...pipelineErrors];

    if (statsNewLeads === 0 && statsUpdatedLeads === 0 && totalProcessed === 0) {
      return NextResponse.json(
        {
          error: `Erro ao salvar leads: ${allErrors.join('; ')}`,
          details: allErrors,
        },
        { status: 500 }
      );
    }

    // Build descriptive message
    const messageParts: string[] = [];
    if (statsNewLeads > 0) messageParts.push(`${statsNewLeads} novos`);
    if (statsUpdatedLeads > 0) messageParts.push(`${statsUpdatedLeads} atualizados`);
    if (statsIgnoredLeads > 0) messageParts.push(`${statsIgnoredLeads} sem alteração`);

    const message = `Importação concluída: ${messageParts.join(', ')}${allErrors.length > 0 ? ` (${allErrors.length} avisos)` : ''}`;

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
        },
        errors: allErrors.length > 0 ? allErrors : undefined,
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
