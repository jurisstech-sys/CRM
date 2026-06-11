'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { History, ArrowRight, Loader2, Plus, Pencil, Trash2, MoveRight } from 'lucide-react'
import { getEntityActivityLogs, ActivityLog } from '@/lib/activities'

interface LeadActivityHistoryProps {
  leadId: string
}

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  create: { label: 'Criação', icon: <Plus className="w-3 h-3" />, color: 'text-green-400 bg-green-500/20' },
  update: { label: 'Atualização', icon: <Pencil className="w-3 h-3" />, color: 'text-blue-400 bg-blue-500/20' },
  move: { label: 'Movimentação', icon: <MoveRight className="w-3 h-3" />, color: 'text-amber-400 bg-amber-500/20' },
  delete: { label: 'Exclusão', icon: <Trash2 className="w-3 h-3" />, color: 'text-red-400 bg-red-500/20' },
}

export function LeadActivityHistory({ leadId }: LeadActivityHistoryProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getEntityActivityLogs(leadId, 'lead')
      setLogs(data)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    if (leadId) load()
  }, [leadId, load])

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <History className="w-4 h-4 text-amber-400" />
        Histórico do Pipeline (Auditoria)
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-400">Carregando...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-4 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
          Nenhuma movimentação registrada ainda.
        </div>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {logs.map((log) => {
            const meta = ACTION_META[log.action_type] || ACTION_META.update
            return (
              <div
                key={log.id}
                className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 flex items-start gap-3"
              >
                <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300">{meta.label}</span>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {log.created_at
                        ? format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : ''}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-0.5">{log.description}</p>
                  {log.old_value && log.new_value && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-700/60">{log.old_value}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="px-2 py-0.5 rounded bg-slate-700/60">{log.new_value}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
