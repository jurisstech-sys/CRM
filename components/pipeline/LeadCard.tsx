'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Mail, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

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
  email1?: string | null
  email2?: string | null
  email3?: string | null
  phone1?: string | null
  phone2?: string | null
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
  onClick?: (lead: Lead) => void
  isSelected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  showCheckbox?: boolean
}

export function LeadCard({ lead, onDelete, onClick, isSelected, onSelect, showCheckbox }: LeadCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Tem certeza que deseja deletar este lead?')) {
      onDelete?.(lead.id)
    }
  }

  const handleCheckbox = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect?.(lead.id, !isSelected)
  }

  const handleClick = () => {
    onClick?.(lead)
  }

  const formattedValue = lead.value
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: lead.currency || 'BRL',
      }).format(lead.value)
    : null

  const formattedDate = lead.expected_close_date
    ? format(new Date(lead.expected_close_date), 'dd MMM yyyy', { locale: pt })
    : null

  const statusColors: Record<string, string> = {
    backlog: 'bg-gray-500/20 text-gray-300',
    em_contato: 'bg-blue-500/20 text-blue-300',
    em_negociacao: 'bg-yellow-500/20 text-yellow-300',
    negociacao_fechada: 'bg-green-500/20 text-green-300',
    lead_nao_qualificado: 'bg-red-500/20 text-red-300',
    prospeccao_futura: 'bg-purple-500/20 text-purple-300',
  }

  const statusLabels: Record<string, string> = {
    backlog: 'Backlog',
    em_contato: 'Em Contato',
    em_negociacao: 'Em Negociação',
    negociacao_fechada: 'Negociação Fechada',
    lead_nao_qualificado: 'Lead Não Qualificado',
    prospeccao_futura: 'Prospecção Futura',
  }

  // Get display emails/phones from separate fields or fallback to description
  const emails = [lead.email1, lead.email2, lead.email3].filter(Boolean)
  const phones = [lead.phone1, lead.phone2].filter(Boolean)

  return (
    <Card
      className={`p-4 bg-slate-800 border-slate-700 cursor-pointer hover:shadow-lg hover:bg-slate-750 transition-all ${
        isSelected ? 'ring-2 ring-blue-500 bg-slate-700' : ''
      }`}
      onClick={handleClick}
    >
      <div className="space-y-2">
        {/* Header with checkbox and delete */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {showCheckbox && (
              <div onClick={handleCheckbox} className="shrink-0">
                <input
                  type="checkbox"
                  checked={isSelected || false}
                  readOnly
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 cursor-pointer"
                />
              </div>
            )}
            <h3 className="font-semibold text-sm text-white truncate">
              {lead.title}
            </h3>
          </div>
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-red-900 hover:text-red-200 shrink-0 ml-1"
              onClick={handleDelete}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Client name */}
        {lead.client_name && (
          <p className="text-xs text-slate-400">{lead.client_name}</p>
        )}

        {/* Emails from separate fields */}
        {emails.length > 0 && (
          <div className="flex items-start gap-1 text-xs text-slate-400">
            <Mail className="w-3 h-3 mt-0.5 shrink-0 text-blue-400" />
            <div className="truncate">{emails[0]}</div>
            {emails.length > 1 && (
              <span className="text-slate-500 shrink-0">+{emails.length - 1}</span>
            )}
          </div>
        )}

        {/* Phones from separate fields */}
        {phones.length > 0 && (
          <div className="flex items-start gap-1 text-xs text-slate-400">
            <Phone className="w-3 h-3 mt-0.5 shrink-0 text-green-400" />
            <div className="truncate">{phones[0]}</div>
            {phones.length > 1 && (
              <span className="text-slate-500 shrink-0">+{phones.length - 1}</span>
            )}
          </div>
        )}

        {/* Fallback: contact info from description if no separate fields */}
        {emails.length === 0 && phones.length === 0 && lead.description && 
         (lead.description.includes('📱') || lead.description.includes('📧')) && (
          <div className="text-xs text-slate-400 space-y-0.5">
            {lead.description.split(' | ').map((part, i) => (
              <p key={i} className="truncate">{part}</p>
            ))}
          </div>
        )}

        {/* Value */}
        {formattedValue && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Valor:</span>
            <span className="font-semibold text-green-400">{formattedValue}</span>
          </div>
        )}

        {/* Expected close date */}
        {formattedDate && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Prazo:</span>
            <span className="text-slate-300">{formattedDate}</span>
          </div>
        )}

        {/* Status badge */}
        <div>
          <Badge
            className={`text-xs ${statusColors[lead.status] || 'bg-gray-100 text-gray-800'}`}
          >
            {statusLabels[lead.status] || lead.status}
          </Badge>
        </div>
      </div>
    </Card>
  )
}
