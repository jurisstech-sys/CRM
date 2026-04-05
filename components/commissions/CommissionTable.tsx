'use client'

import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

export interface Commission {
  id: string
  lead_id: string
  user_id: string
  amount: number
  percentage: number
  currency: string
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  calculation_method: 'fixed' | 'percentage' | 'tiered'
  payment_date?: string
  notes?: string
  created_at: string
  updated_at: string
  lead_title?: string
  user_name?: string
}

interface CommissionTableProps {
  commissions: Commission[]
  isLoading?: boolean
  onStatusChange?: (commissionId: string, newStatus: string) => Promise<void>
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'approved':
      return 'bg-blue-100 text-blue-800'
    case 'paid':
      return 'bg-green-100 text-green-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4" />
    case 'paid':
      return <CheckCircle2 className="w-4 h-4" />
    case 'cancelled':
      return <XCircle className="w-4 h-4" />
    default:
      return null
  }
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    approved: 'Aprovada',
    paid: 'Paga',
    cancelled: 'Cancelada',
  }
  return labels[status] || status
}

export function CommissionTable({ commissions, isLoading = false, onStatusChange }: CommissionTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleStatusClick = (commissionId: string, currentStatus: string) => {
    setSelectedId(commissionId)
    setSelectedStatus(currentStatus)
    setIsDialogOpen(true)
  }

  const handleConfirmStatusChange = async () => {
    if (selectedId && selectedStatus && onStatusChange) {
      try {
        let newStatus = ''
        if (selectedStatus === 'pending') {
          newStatus = 'approved'
        } else if (selectedStatus === 'approved') {
          newStatus = 'paid'
        }

        if (newStatus) {
          await onStatusChange(selectedId, newStatus)
        }
      } finally {
        setIsDialogOpen(false)
        setSelectedId(null)
        setSelectedStatus(null)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-slate-400">Carregando comissões...</p>
      </div>
    )
  }

  if (commissions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-slate-400">Nenhuma comissão registrada</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-slate-800">
              <TableHead className="text-slate-300">Lead</TableHead>
              <TableHead className="text-slate-300">Comercial</TableHead>
              <TableHead className="text-right text-slate-300">Valor</TableHead>
              <TableHead className="text-right text-slate-300">Taxa (%)</TableHead>
              <TableHead className="text-right text-slate-300">Comissão</TableHead>
              <TableHead className="text-slate-300">Status</TableHead>
              <TableHead className="text-slate-300">Data</TableHead>
              {onStatusChange && <TableHead className="text-slate-300">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.map((commission) => (
              <TableRow key={commission.id} className="border-slate-700 hover:bg-slate-800">
                <TableCell className="font-medium text-white">
                  {commission.lead_title || `Lead ${commission.lead_id.substring(0, 8)}`}
                </TableCell>
                <TableCell className="text-slate-300">
                  {commission.user_name || 'Sem nome'}
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: commission.currency,
                  }).format(commission.amount / (commission.percentage / 100))}
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {commission.percentage.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right font-semibold text-green-400">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: commission.currency,
                  }).format(commission.amount)}
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${getStatusColor(commission.status)}`}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(commission.status)}
                      {getStatusLabel(commission.status)}
                    </span>
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-300">
                  {format(new Date(commission.created_at), 'dd MMM yyyy', {
                    locale: pt,
                  })}
                </TableCell>
                {onStatusChange && (
                  <TableCell>
                    {commission.status !== 'paid' && commission.status !== 'cancelled' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-xs"
                        onClick={() => handleStatusClick(commission.id, commission.status)}
                      >
                        Avançar
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar alteração de status</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Deseja alterar o status desta comissão para{' '}
              {selectedStatus === 'pending' ? 'Aprovada' : 'Paga'}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction
            onClick={handleConfirmStatusChange}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Confirmar
          </AlertDialogAction>
          <AlertDialogCancel className="border-slate-600">Cancelar</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
