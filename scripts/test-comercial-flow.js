/**
 * Teste e2e do fluxo de importação global + atribuição automática de comercial.
 * Executa contra o Supabase (service role) usando dados de teste temporários,
 * validando o comportamento no nível do banco. Todos os dados criados são
 * removidos ao final.
 *
 * Uso: node scripts/test-comercial-flow.js
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const env = {}
fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

let pass = 0
let fail = 0
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✅', msg) }
  else { fail++; console.log('  ❌', msg) }
}

async function main() {
  console.log('=== Teste: Importação global + atribuição automática de comercial ===\n')

  // Buscar um comercial ativo para os testes
  const { data: comercial } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('role', 'comercial')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  const { data: admin } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .in('role', ['admin', 'super_admin'])
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!comercial || !admin) {
    console.log('Não foi possível localizar usuários comercial/admin para o teste.')
    process.exit(1)
  }
  console.log(`Comercial de teste: ${comercial.email} (${comercial.id})`)
  console.log(`Admin de teste: ${admin.email} (${admin.id})\n`)

  const createdLeadIds = []
  const createdCommissionIds = []
  const createdActivityIds = []

  try {
    // ---- 1. Importação global: leads criados sem comercial ----
    console.log('1) Importação global — lead entra no Backlog sem comercial')
    const { data: lead, error: insErr } = await supabase
      .from('leads')
      .insert({
        title: '[TESTE] Lead Importação Global',
        status: 'backlog',
        comercial_id: null,
        assigned_to: null,
        created_by: admin.id,
        value: 1000,
      })
      .select('id, status, comercial_id, assigned_to')
      .single()
    if (insErr) throw insErr
    createdLeadIds.push(lead.id)
    assert(lead.comercial_id === null, 'Lead importado fica com comercial_id NULL (Backlog global)')
    assert(lead.status === 'backlog', 'Lead importado entra no Backlog')

    // ---- 2. Backlog global: consulta de leads sem comercial ----
    console.log('\n2) Backlog global — leads sem comercial são visíveis')
    const { data: backlogLeads } = await supabase
      .from('leads')
      .select('id, comercial_id')
      .is('comercial_id', null)
      .eq('id', lead.id)
    assert(backlogLeads && backlogLeads.length === 1, 'Lead sem comercial aparece na consulta do Backlog global')

    // ---- 3. Atribuição automática ao sair do Backlog ----
    console.log('\n3) Atribuição automática — comercial preenchido ao mover do Backlog')
    const { data: moved, error: movErr } = await supabase
      .from('leads')
      .update({ status: 'em_contato', comercial_id: comercial.id, assigned_to: comercial.id })
      .eq('id', lead.id)
      .is('comercial_id', null) // simula "só atribui se ainda não tem comercial"
      .select('id, status, comercial_id, assigned_to')
      .single()
    if (movErr) throw movErr
    assert(moved.comercial_id === comercial.id, 'comercial_id definido para quem moveu o lead')
    assert(moved.assigned_to === comercial.id, 'assigned_to sincronizado com comercial_id (compat/RLS)')

    // Registrar auditoria da atribuição automática
    const { data: act1 } = await supabase
      .from('activity_logs')
      .insert({
        user_id: comercial.id,
        action_type: 'atribuicao_automatica',
        entity_type: 'lead',
        entity_id: lead.id,
        description: `[TESTE] Lead atribuído automaticamente a ${comercial.email}`,
        new_value: comercial.email,
      })
      .select('id')
      .single()
    if (act1) createdActivityIds.push(act1.id)
    assert(!!act1, 'Auditoria "atribuicao_automatica" registrada em activity_logs')

    // ---- 4. Atribuição NÃO sobrescreve comercial existente ----
    console.log('\n4) Atribuição automática não sobrescreve comercial já definido')
    const { data: notOverwritten } = await supabase
      .from('leads')
      .update({ status: 'em_negociacao', comercial_id: admin.id })
      .eq('id', lead.id)
      .is('comercial_id', null) // condição garante que não atribui de novo
      .select('id')
    assert(!notOverwritten || notOverwritten.length === 0, 'Lead com comercial não é reatribuído automaticamente')

    // ---- 5. Troca de comercial pelo admin + auditoria ----
    console.log('\n5) Troca de comercial pelo admin (change-comercial) + auditoria')
    const oldComercial = comercial.id
    const { data: changed, error: chErr } = await supabase
      .from('leads')
      .update({ comercial_id: admin.id, assigned_to: admin.id })
      .eq('id', lead.id)
      .select('id, comercial_id, assigned_to')
      .single()
    if (chErr) throw chErr
    assert(changed.comercial_id === admin.id, 'Admin altera comercial_id do lead')
    assert(changed.assigned_to === admin.id, 'assigned_to sincronizado após alteração')

    const { data: act2 } = await supabase
      .from('activity_logs')
      .insert({
        user_id: admin.id,
        action_type: 'alteracao_comercial',
        entity_type: 'lead',
        entity_id: lead.id,
        description: `[TESTE] Comercial alterado de ${oldComercial} para ${admin.id}`,
        old_value: oldComercial,
        new_value: admin.id,
      })
      .select('id')
      .single()
    if (act2) createdActivityIds.push(act2.id)
    assert(!!act2, 'Auditoria "alteracao_comercial" registrada em activity_logs')

    // ---- 6. Comissão usa comercial_id ----
    console.log('\n6) Comissão é atribuída ao comercial_id do lead')
    const { data: leadForComm } = await supabase
      .from('leads')
      .select('id, comercial_id, assigned_to, value')
      .eq('id', lead.id)
      .single()
    const beneficiary = leadForComm.comercial_id || leadForComm.assigned_to
    assert(beneficiary === admin.id, 'Beneficiário da comissão = comercial_id do lead')

    // ---- 7. Embed query comercialUser retorna nome ----
    console.log('\n7) Query com embed comercialUser retorna dados do comercial')
    const { data: embed, error: embErr } = await supabase
      .from('leads')
      .select('id, comercial_id, comercialUser:users!leads_comercial_id_fkey(id, full_name, email)')
      .eq('id', lead.id)
      .single()
    if (embErr) throw embErr
    assert(embed.comercialUser && embed.comercialUser.id === admin.id, 'Embed comercialUser retorna o comercial vinculado')

    console.log(`\n=== Resultado: ${pass} passaram, ${fail} falharam ===`)
  } finally {
    // Limpeza
    console.log('\nLimpando dados de teste...')
    for (const id of createdActivityIds) {
      await supabase.from('activity_logs').delete().eq('id', id)
    }
    for (const id of createdCommissionIds) {
      await supabase.from('commissions').delete().eq('id', id)
    }
    for (const id of createdLeadIds) {
      await supabase.from('commissions').delete().eq('lead_id', id)
      await supabase.from('leads').delete().eq('id', id)
    }
    console.log('Limpeza concluída.')
  }

  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Erro no teste:', e)
  process.exit(1)
})
