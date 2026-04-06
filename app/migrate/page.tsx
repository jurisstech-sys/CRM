'use client'

import { useState } from 'react'

export default function MigratePage() {
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  const runMigration = async () => {
    setLoading(true)
    setStatus('Executando migração...')
    setResult(null)

    try {
      const res = await fetch('/api/migrate/add-lead-columns', {
        method: 'POST'
      })
      const data = await res.json()
      setResult(data)

      if (data.success) {
        setStatus('✅ Migração executada com sucesso!')
      } else if (data.fallback === 'direct_sql') {
        setStatus('⚠️ API não suporta DDL. Executando via SQL direto...')
        // Tentar via script direto
        await runDirectSQL(data.sql)
      } else {
        setStatus(`❌ Erro: ${data.error || data.message}`)
      }
    } catch (error) {
      setStatus(`❌ Erro de rede: ${String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const runDirectSQL = async (sql: string) => {
    try {
      const res = await fetch('/api/migrate/direct-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      })
      const data = await res.json()
      setResult(data)
      if (data.success) {
        setStatus('✅ Migração executada com sucesso via SQL direto!')
      } else {
        setStatus(`❌ Erro no SQL direto: ${data.error || data.message}`)
      }
    } catch (error) {
      setStatus(`❌ Erro: ${String(error)}`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-slate-800 rounded-xl p-8 shadow-lg">
        <h1 className="text-2xl font-bold mb-2">🔧 Migração do Banco</h1>
        <p className="text-slate-400 mb-6">
          Adicionar colunas de contato na tabela leads:
          <br />
          <code className="text-blue-400">email1, email2, email3, phone1, phone2</code>
        </p>

        <button
          onClick={runMigration}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-4"
        >
          {loading ? '⏳ Executando...' : '🚀 Adicionar Colunas de Leads'}
        </button>

        {status && (
          <div className="mt-4 p-4 rounded-lg bg-slate-700">
            <p className="text-lg">{status}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 rounded-lg bg-slate-700">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Resultado:</h3>
            <pre className="text-xs text-green-400 overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
