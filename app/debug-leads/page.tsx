'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DebugLeads() {
  const [leads, setLeads] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [apiLeads, setApiLeads] = useState<any[]>([])
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    async function debug() {
      try {
        // 1. Get current user
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        setUser(currentUser)

        if (currentUser) {
          // 2. Check user role
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single()
          setUserRole(userData?.role || 'not found in users table')
        }

        // 3. Direct query - all leads without filter
        const { data, error: queryError } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (queryError) {
          setError(queryError.message)
        } else {
          setLeads(data || [])
          setTotal(data?.length || 0)
        }

        // 4. Test API route
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          const res = await fetch('/api/leads', {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          })
          const json = await res.json()
          if (res.ok) {
            setApiLeads(json.leads || [])
          } else {
            setApiError(json.error || `HTTP ${res.status}`)
          }
        }
      } catch (err: any) {
        setError(err.message)
      }
    }
    debug()
  }, [])

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-6">🔍 DEBUG - Leads</h1>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-2">👤 Usuário Logado</h2>
          <p><strong>ID:</strong> {user?.id || 'Não logado'}</p>
          <p><strong>Email:</strong> {user?.email || '-'}</p>
          <p><strong>Role na tabela users:</strong> <span className={userRole === 'admin' ? 'text-green-400' : 'text-red-400'}>{userRole}</span></p>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-2">📊 Contagem</h2>
          <p><strong>Query direta (browser client):</strong> {total} leads</p>
          <p><strong>Via API /api/leads:</strong> {apiError ? <span className="text-red-400">{apiError}</span> : `${apiLeads.length} leads`}</p>
          {error && <p className="text-red-400 mt-2">Erro: {error}</p>}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="bg-slate-800 p-4 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-2">📈 Breakdown por Status</h2>
        <div className="grid grid-cols-3 gap-4">
          {['backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura'].map(status => {
            const count = leads.filter(l => l.status === status).length
            return (
              <div key={status} className="bg-slate-700 p-3 rounded">
                <p className="font-mono text-sm">{status}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            )
          })}
          <div className="bg-red-900/50 p-3 rounded">
            <p className="font-mono text-sm">outros status</p>
            <p className="text-2xl font-bold">{leads.filter(l => !['backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura'].includes(l.status)).length}</p>
          </div>
        </div>
      </div>

      {/* Leads with unknown status */}
      {leads.filter(l => !['backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura'].includes(l.status)).length > 0 && (
        <div className="bg-red-900/30 p-4 rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-2 text-red-400">⚠️ Leads com Status Desconhecido</h2>
          {leads.filter(l => !['backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura'].includes(l.status)).map(lead => (
            <div key={lead.id} className="bg-slate-800 p-3 rounded mb-2">
              <p><strong>Nome:</strong> {lead.title} | <strong>Status:</strong> <span className="text-red-400 font-mono">&ldquo;{lead.status}&rdquo;</span> | <strong>ID:</strong> {lead.id}</p>
            </div>
          ))}
        </div>
      )}

      {/* All leads table */}
      <div className="bg-slate-800 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-4">📋 Todos os Leads ({total})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-2">Título</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Assigned To</th>
                <th className="text-left p-2">Created By</th>
                <th className="text-left p-2">Valor</th>
                <th className="text-left p-2">Criado Em</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="p-2">{lead.title}</td>
                  <td className="p-2 font-mono text-xs">{lead.status}</td>
                  <td className="p-2 font-mono text-xs">{lead.assigned_to || <span className="text-yellow-400">NULL</span>}</td>
                  <td className="p-2 font-mono text-xs">{lead.created_by || <span className="text-yellow-400">NULL</span>}</td>
                  <td className="p-2">{lead.value ? `R$ ${lead.value}` : '-'}</td>
                  <td className="p-2 text-xs">{lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
