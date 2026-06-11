/**
 * Sincronização de usuários: Supabase Auth → tabela public.users
 *
 * O que faz:
 *  1. Busca TODOS os usuários do Supabase Auth (auth.users) via Admin API.
 *  2. Compara com a tabela public.users.
 *  3. Insere os que estão faltando (usuários "fantasma" que existem só no Auth).
 *  4. Atualiza email dos que já existem (mantém role/status/deleted_at intactos).
 *  5. Reporta divergências.
 *
 * NÃO altera deleted_at de quem já está na tabela (preserva exclusões).
 *
 * Uso: node scripts/sync-auth-users.js
 */
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const env = fs.readFileSync(envPath, 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : undefined
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    serviceKey: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

async function main() {
  const { url, serviceKey } = loadEnv()
  if (!url || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('🔄 Sincronizando usuários do Auth para public.users...\n')

  // 1. Buscar todos os usuários do Auth (paginado)
  const authUsers = []
  let page = 1
  const perPage = 1000
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('❌ Erro ao listar usuários do Auth:', error.message)
      process.exit(1)
    }
    authUsers.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }
  console.log(`📋 Auth: ${authUsers.length} usuário(s) encontrado(s)`)

  // 2. Buscar todos os usuários da tabela public.users
  const { data: dbUsers, error: dbErr } = await admin
    .from('users')
    .select('id, email, role, status, deleted_at, full_name')
  if (dbErr) {
    console.error('❌ Erro ao ler public.users:', dbErr.message)
    process.exit(1)
  }
  console.log(`📋 public.users: ${dbUsers.length} registro(s)\n`)

  const dbById = new Map(dbUsers.map((u) => [u.id, u]))

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const au of authUsers) {
    const existing = dbById.get(au.id)
    if (!existing) {
      // 3. Inserir usuário faltante. Tenta inferir nome dos metadados.
      const fullName =
        au.user_metadata?.full_name || au.user_metadata?.name || null
      const { error: insErr } = await admin.from('users').insert({
        id: au.id,
        email: au.email || '',
        full_name: fullName,
        role: 'comercial',
        status: 'active',
        created_at: au.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (insErr) {
        console.error(`   ⚠️  Falha ao inserir ${au.email}: ${insErr.message}`)
      } else {
        console.log(`   ➕ Inserido: ${au.email} (role=comercial, status=active)`)
        inserted++
      }
    } else {
      // 4. Atualizar email se divergente (preserva role/status/deleted_at)
      if (existing.email !== au.email && au.email) {
        const { error: updErr } = await admin
          .from('users')
          .update({ email: au.email, updated_at: new Date().toISOString() })
          .eq('id', au.id)
        if (updErr) {
          console.error(`   ⚠️  Falha ao atualizar ${au.email}: ${updErr.message}`)
        } else {
          console.log(`   ✏️  Email atualizado: ${existing.email} → ${au.email}`)
          updated++
        }
      } else {
        skipped++
      }
    }
  }

  // 5. Relatório de divergências: registros em public.users sem par no Auth
  const authIds = new Set(authUsers.map((u) => u.id))
  const ghostsInDb = dbUsers.filter((u) => !authIds.has(u.id))
  if (ghostsInDb.length > 0) {
    console.log('\n⚠️  Registros em public.users SEM usuário correspondente no Auth:')
    ghostsInDb.forEach((u) => console.log(`   - ${u.email} (${u.id})`))
  }

  console.log('\n✅ Sincronização concluída.')
  console.log(`   Inseridos: ${inserted} | Atualizados: ${updated} | Sem mudança: ${skipped}`)

  // Estado final
  const { data: finalUsers } = await admin
    .from('users')
    .select('email, role, status, deleted_at')
    .order('created_at', { ascending: true })
  console.log('\n📊 Estado final de public.users:')
  finalUsers.forEach((u) => {
    const flag = u.deleted_at ? '🗑️ EXCLUÍDO' : '✓ ativo'
    console.log(`   - ${u.email} | ${u.role} | ${u.status} | ${flag}`)
  })
}

main().catch((e) => {
  console.error('ERRO FATAL:', e.message)
  process.exit(1)
})
