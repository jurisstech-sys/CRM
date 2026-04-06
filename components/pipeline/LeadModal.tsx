'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Trash2, Save, X, Mail, Phone, User, DollarSign, Calendar, Percent, ArrowRightLeft } from 'lucide-react'
import type { Lead } from './LeadCard'
import { LeadTimeline } from './LeadTimeline'

interface LeadModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onSave: (lead: Lead) => void
  onDelete?: (id: string) => void
  canDelete?: boolean
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Novo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'negotiation', label: 'Negociação' },
  { value: 'won', label: 'Fechado (Ganho)' },
  { value: 'lost', label: 'Perdido' },
]

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  contacted: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  qualified: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  proposal: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  negotiation: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  won: 'bg-green-500/20 text-green-300 border-green-500/30',
  lost: 'bg-red-500/20 text-red-300 border-red-500/30',
}

export function LeadModal({ lead, isOpen, onClose, onSave, onDelete, canDelete }: LeadModalProps) {
  const [editData, setEditData] = useState<Lead | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details')

  useEffect(() => {
    if (lead) {
      setEditData({ ...lead })
      setActiveTab('details')
    }
  }, [lead])

  if (!editData) return null

  const handleSave = () => {
    if (!editData.title.trim()) {
      toast.error('Nome do lead é obrigatório')
      return
    }
    onSave(editData)
    onClose()
  }

  const handleDelete = () => {
    if (editData && onDelete) {
      if (window.confirm(`Tem certeza que deseja excluir "${editData.title}"? Esta ação não pode ser desfeita.`)) {
        onDelete(editData.id)
        onClose()
      }
    }
  }

  const handleStatusChange = (newStatus: string) => {
    setEditData({ ...editData, status: newStatus })
  }

  const formattedValue = editData.value
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(editData.value)
    : 'R$ 0,00'

  const statusLabel = STATUS_OPTIONS.find((s) => s.value === editData.status)?.label || editData.status

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white text-xl flex items-center gap-3">
              <User className="w-5 h-5 text-blue-400" />
              {editData.title}
            </DialogTitle>
            <Badge className={`${statusColors[editData.status] || 'bg-gray-500/20 text-gray-300'} border`}>
              {statusLabel}
            </Badge>
          </div>
          {editData.value !== null && editData.value !== undefined && (
            <p className="text-green-400 font-semibold text-lg">{formattedValue}</p>
          )}
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-700 mb-2">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'details'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('details')}
          >
            Detalhes
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'timeline'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline / Comentários
          </button>
        </div>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-5 mt-2">
            {/* Status Select */}
            <div>
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2 mb-1">
                <ArrowRightLeft className="w-4 h-4" /> Mudar Status
              </label>
              <Select value={editData.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-white hover:bg-slate-700 focus:bg-slate-700"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome */}
            <div>
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <User className="w-4 h-4" /> Nome *
              </label>
              <Input
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                placeholder="Nome do lead"
              />
            </div>

            {/* Emails */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Emails
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  value={editData.email1 || ''}
                  onChange={(e) => setEditData({ ...editData, email1: e.target.value || null })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Email principal"
                  type="email"
                />
                <Input
                  value={editData.email2 || ''}
                  onChange={(e) => setEditData({ ...editData, email2: e.target.value || null })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Email secundário"
                  type="email"
                />
                <Input
                  value={editData.email3 || ''}
                  onChange={(e) => setEditData({ ...editData, email3: e.target.value || null })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Email terciário"
                  type="email"
                />
              </div>
            </div>

            {/* Phones */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Phone className="w-4 h-4" /> Telefones
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  value={editData.phone1 || ''}
                  onChange={(e) => setEditData({ ...editData, phone1: e.target.value || null })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Telefone principal"
                />
                <Input
                  value={editData.phone2 || ''}
                  onChange={(e) => setEditData({ ...editData, phone2: e.target.value || null })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Telefone secundário"
                />
              </div>
            </div>

            {/* Value + Date + Probability */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Valor
                </label>
                <Input
                  type="number"
                  value={editData.value || ''}
                  onChange={(e) =>
                    setEditData({ ...editData, value: e.target.value ? parseFloat(e.target.value) : null })
                  }
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Data Fechamento
                </label>
                <Input
                  type="date"
                  value={editData.expected_close_date || ''}
                  onChange={(e) => setEditData({ ...editData, expected_close_date: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Percent className="w-4 h-4" /> Probabilidade
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editData.probability || ''}
                  onChange={(e) =>
                    setEditData({ ...editData, probability: e.target.value ? parseFloat(e.target.value) : null })
                  }
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  placeholder="0-100"
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-sm font-medium text-slate-400">Observações</label>
              <Textarea
                value={editData.description || ''}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                rows={3}
                placeholder="Observações sobre o lead..."
              />
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && editData.id && (
          <div className="mt-2">
            <LeadTimeline leadId={editData.id} />
          </div>
        )}

        <DialogFooter className="flex justify-between gap-2 mt-4">
          <div>
            {canDelete && onDelete && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-700"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
