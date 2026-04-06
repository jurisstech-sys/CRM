import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta (Supabase)' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Migrar todos os status antigos para novos na tabela leads
    const migrations = [
      { old: 'novo', new: 'backlog' },
      { old: 'new', new: 'backlog' },
      { old: 'qualificado', new: 'em_contato' },
      { old: 'contacted', new: 'em_contato' },
      { old: 'proposta', new: 'em_negociacao' },
      { old: 'proposal', new: 'em_negociacao' },
      { old: 'negotiation', new: 'em_negociacao' },
      { old: 'fechado', new: 'negociacao_fechada' },
      { old: 'won', new: 'negociacao_fechada' },
      { old: 'closed', new: 'negociacao_fechada' },
      { old: 'lost', new: 'lead_nao_qualificado' },
      { old: 'perdido', new: 'lead_nao_qualificado' },
      { old: 'descartado', new: 'lead_nao_qualificado' },
    ]

    const results: { status: string; from: string; to: string; count: number }[] = []

    for (const m of migrations) {
      const { data, error } = await supabase
        .from('leads')
        .update({ status: m.new })
        .eq('status', m.old)
        .select('id')

      if (error) {
        console.error(`[Migration] Erro migrando ${m.old} -> ${m.new}:`, error.message)
        results.push({ status: 'error', from: m.old, to: m.new, count: 0 })
      } else {
        const count = data?.length || 0
        console.log(`[Migration] ✅ ${m.old} -> ${m.new}: ${count} leads migrados`)
        results.push({ status: 'ok', from: m.old, to: m.new, count })
      }
    }

    // Também migrar na tabela imported_leads se existir
    for (const m of migrations) {
      await supabase
        .from('imported_leads')
        .update({ status: m.new })
        .eq('status', m.old)
    }

    const totalMigrated = results.reduce((sum, r) => sum + r.count, 0)

    return NextResponse.json({
      success: true,
      message: `Migração concluída: ${totalMigrated} leads migrados`,
      totalMigrated,
      details: results,
    })
  } catch (error) {
    console.error('[Migration] Erro geral:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
