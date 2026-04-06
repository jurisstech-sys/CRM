import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'Missing Supabase credentials' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })

    // Tentativa 1: Usar rpc exec_sql se existir
    // Tentativa 2: Usar REST API com SQL direto
    // Tentativa 3: Adicionar colunas uma a uma via alter table

    const columns = [
      { name: 'email1', type: 'TEXT' },
      { name: 'email2', type: 'TEXT' },
      { name: 'email3', type: 'TEXT' },
      { name: 'phone1', type: 'TEXT' },
      { name: 'phone2', type: 'TEXT' },
    ]

    const results: { column: string; status: string; error?: string }[] = []

    // Primeiro, verificar quais colunas já existem
    const { data: existingData, error: checkError } = await supabase
      .from('leads')
      .select('*')
      .limit(1)

    const existingColumns = existingData && existingData.length > 0
      ? Object.keys(existingData[0])
      : []

    // Se não há dados, tentar um select vazio para ver os headers
    let knownColumns: string[] = existingColumns

    // Tentar adicionar cada coluna via SQL direto usando a Database REST API
    // Supabase expõe /rest/v1/rpc para funções, mas para DDL precisamos usar
    // a conexão direta ou a Management API

    // Abordagem: usar fetch direto para a Supabase Management API (SQL)
    const sqlStatements = columns.map(
      col => `ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
    )
    const fullSQL = sqlStatements.join('\n')

    // Tentar via rpc primeiro
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql_query: fullSQL
    })

    if (!rpcError) {
      return NextResponse.json({
        success: true,
        message: 'Colunas adicionadas com sucesso via exec_sql',
        columns: columns.map(c => c.name)
      })
    }

    console.log('exec_sql não disponível, tentando via REST SQL...',  rpcError.message)

    // Tentativa via Supabase SQL endpoint (pg REST)
    const sqlEndpoint = `${supabaseUrl}/rest/v1/`
    
    // Tentativa via Database URL direto com pg
    // Como alternativa final, vamos tentar criar a função exec_sql primeiro
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
      RETURNS void AS $$
      BEGIN
        EXECUTE sql_query;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `

    // Usar a API de SQL do Supabase diretamente via fetch
    const pgResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql_query: fullSQL })
    })

    if (pgResponse.ok) {
      return NextResponse.json({
        success: true,
        message: 'Colunas adicionadas com sucesso',
        columns: columns.map(c => c.name)
      })
    }

    // Última tentativa: usar a API SQL do Supabase
    const sqlApiResponse = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: fullSQL })
    })

    if (sqlApiResponse.ok) {
      return NextResponse.json({
        success: true,
        message: 'Colunas adicionadas via SQL API',
        columns: columns.map(c => c.name)
      })
    }

    // Se nenhuma abordagem via API funcionou, retornar instruções
    return NextResponse.json({
      success: false,
      message: 'Não foi possível executar DDL via API. Executando via conexão direta...',
      fallback: 'direct_sql',
      sql: fullSQL,
      rpcError: rpcError?.message
    }, { status: 422 })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST para executar a migração de colunas de leads',
    columns: ['email1', 'email2', 'email3', 'phone1', 'phone2']
  })
}
