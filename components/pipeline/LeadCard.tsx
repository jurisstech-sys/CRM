'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Edit2 } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export interface Lead {
  id: string
  client_id: string | null
  title: string
  description?: string | null
  source?: string | null
  value?: number | null
  currency?: string
  status: string
  assigned_to?: string | null
  expected_close_date?: string | null
  probability?: number | null
  next_follow_up?: string | null
  created_at: string
  updated_at: string
  created_by: string
  updated_by?: string | null
  client_name?: string
  client_email?: string
}

interface LeadCardProps {
  lead: Lead
  onDelete?: (id: string) => void
  onUpdate?: (lead: Lead) => void
}

export function LeadCard({ lead, onDelete, onUpdate }: LeadCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editData, setEditData] = useState(lead)

  const handleEdit = () => {
    setEditData(lead)
    setIsDetailOpen(true)
  }

  const handleSave = () => {
    if (!editData.title.trim()) {
      toast.error('Título do lead é obrigatório')
      return
    }
    onUpdate?.(editData)
    setIsDetailOpen(false)
  }

  const handleDelete = () => {
    if (window.confirm('Tem certeza que deseja deletar este lead?')) {
      onDelete?.(lead.id)
    }
  }

  const formattedValue = lead.value
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: lead.currency || 'BRL',
      }).format(lead.value)
    : 'N/A'

  const formattedDate = lead.expected_close_date
    ? format(new Date(lead.expected_close_date), 'dd MMM yyyy', { locale: pt })
    : 'N/A'

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    contacted: 'bg-cyan-100 text-cyan-800',
    qualified: 'bg-yellow-100 text-yellow-800',
    proposal: 'bg-orange-100 text-orange-800',
    negotiation: 'bg-purple-100 text-purple-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800',
  }

  const statusLabels: Record<string, string> = {
    new: 'Novo',
    contacted: 'Contactado',
    qualified: 'Qualificado',
    proposal: 'Proposta',
    negotiation: 'Negociação',
    won: 'Fechado',
    lost: 'Perdido',
  }

  return (
    <>
      <Card className="p-4 bg-slate-800 border-slate-700 cursor-grab active:cursor-grabbing hover:shadow-lg transition-shadow">
        <div className="space-y-3">
          {/* Header with delete button */}
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-sm text-white truncate flex-1">
              {lead.title}
            </h3>
            <div className="flex gap-1 ml-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-slate-700"
                onClick={handleEdit}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 hover:bg-red-900 hover:text-red-200"
                  onClick={handleDelete}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Client info if available */}
          {lead.client_name && (
            <p className="text-xs text-slate-400">{lead.client_name}</p>
          )}

          {/* Contact info from description */}
          {lead.description && (lead.description.includes('📱') || lead.description.includes('📧')) && (
            <div className="text-xs text-slate-400 space-y-0.5">
              {lead.description.split(' | ').map((part, i) => (
                <p key={i} className="truncate">{part}</p>
              ))}
            </div>
          )}

          {/* Value and probability */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Valor:</span>
            <span className="font-semibold text-green-400">{formattedValue}</span>
          </div>

          {/* Expected close date */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Prazo:</span>
            <span className="text-slate-300">{formattedDate}</span>
          </div>

          {/* Status badge */}
          <div>
            <Badge
              className={`text-xs ${statusColors[lead.status] || 'bg-gray-100 text-gray-800'}`}
            >
              {statusLabels[lead.status] || lead.status}
            </Badge>
          </div>

          {/* Probability if available */}
          {lead.probability !== null && lead.probability !== undefined && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Probabilidade:</span>
              <span className="text-slate-300">{lead.probability}%</span>
            </div>
          )}
        </div>
      </Card>

      {/* Edit dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Lead</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-400">
                Título *
              </label>
              <Input
                value={editData.title}
                onChange={(e) =>
                  setEditData({ ...editData, title: e.target.value })
                }
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-400">
                Descrição
              </label>
              <Textarea
                value={editData.description || ''}
                onChange={(e) =>
                  setEditData({ ...editData, description: e.target.value })
                }
                className="bg-slate-800 border-slate-700 text-white mt-1"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-400">
                  Valor
                </label>
                <Input
                  type="number"
                  value={editData.value || ''}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      value: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">
                  Data de Fechamento
                </label>
                <Input
                  type="date"
                  value={editData.expected_close_date || ''}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      expected_close_date: e.target.value,
                    })
                  }
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-400">
                Probabilidade (%)
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={editData.probability || ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    probability: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailOpen(false)}
              className="border-slate-700"
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
