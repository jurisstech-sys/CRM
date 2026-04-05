'use client'

import React, { useState, useEffect } from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { Lead } from './LeadCard'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { createCommissionOnWin } from '@/lib/commissions'
import { logActivity } from '@/lib/activities'
import KanbanColumn from './KanbanColumn'

interface KanbanBoardProps {
  onCreateLead?: () => void
}

interface PipelineData {
  [key: string]: Lead[]
}

const PIPELINE_STAGES = [
  { id: 'new', title: 'Novo', color: 'bg-blue-50' },
  { id: 'qualified', title: 'Qualificado', color: 'bg-yellow-50' },
  { id: 'proposal', title: 'Proposta', color: 'bg-orange-50' },
  { id: 'won', title: 'Fechado', color: 'bg-green-50' },
]

export function KanbanBoard({ onCreateLead }: KanbanBoardProps) {
  const [leads, setLeads] = useState<PipelineData>({
    new: [],
    qualified: [],
    proposal: [],
    won: [],
  })
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch leads from Supabase
  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          clients(name, email)
        `)
        .in('status', ['new', 'qualified', 'proposal', 'won'])
        .order('created_at', { ascending: false })

      if (error) throw error

      // Group leads by status
      const grouped: PipelineData = {
        new: [],
        qualified: [],
        proposal: [],
        won: [],
      }

      data?.forEach((lead: any) => {
        const mappedLead: Lead = {
          id: lead.id,
          client_id: lead.client_id,
          title: lead.title,
          description: lead.description,
          source: lead.source,
          value: lead.value,
          currency: lead.currency,
          status: lead.status,
          assigned_to: lead.assigned_to,
          expected_close_date: lead.expected_close_date,
          probability: lead.probability,
          next_follow_up: lead.next_follow_up,
          created_at: lead.created_at,
          updated_at: lead.updated_at,
          created_by: lead.created_by,
          updated_by: lead.updated_by,
          client_name: lead.clients?.name,
          client_email: lead.clients?.email,
        }

        if (lead.status === 'new') grouped.new.push(mappedLead)
        else if (lead.status === 'qualified') grouped.qualified.push(mappedLead)
        else if (lead.status === 'proposal') grouped.proposal.push(mappedLead)
        else if (lead.status === 'won') grouped.won.push(mappedLead)
      })

      setLeads(grouped)
    } catch (error) {
      console.error('Error fetching leads:', error)
      toast.error('Erro ao carregar leads')
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    const draggedLeadId = active.id as string
    const newStatus = over.id as string

    // Find the lead and its current status
    let draggedLead: Lead | null = null
    let oldStatus = ''

    for (const [status, statusLeads] of Object.entries(leads)) {
      const found = statusLeads.find((l) => l.id === draggedLeadId)
      if (found) {
        draggedLead = found
        oldStatus = status
        break
      }
    }

    if (!draggedLead || !oldStatus || !PIPELINE_STAGES.find((s) => s.id === newStatus))
      return

    if (oldStatus === newStatus) return

    // Optimistically update UI
    const newLeads = { ...leads }
    newLeads[oldStatus] = newLeads[oldStatus].filter((l) => l.id !== draggedLeadId)
    draggedLead.status = newStatus
    newLeads[newStatus] = [draggedLead, ...newLeads[newStatus]]
    setLeads(newLeads)

    // Update in Supabase
    try {
      setUpdatingId(draggedLeadId)
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', draggedLeadId)

      if (error) {
        // Rollback on error
        await fetchLeads()
        toast.error('Erro ao atualizar lead')
        return
      }

      // Log the activity
      const oldStatusTitle = PIPELINE_STAGES.find((s) => s.id === oldStatus)?.title || oldStatus
      const newStatusTitle = PIPELINE_STAGES.find((s) => s.id === newStatus)?.title || newStatus
      await logActivity(
        'move',
        'lead',
        draggedLeadId,
        `Lead "${draggedLead.title}" foi movido de "${oldStatusTitle}" para "${newStatusTitle}"`,
        draggedLead.title,
        oldStatusTitle,
        newStatusTitle
      )

      // Create commission if moving to 'won' status
      if (newStatus === 'won' && draggedLead.assigned_to && draggedLead.value) {
        const commission = await createCommissionOnWin(
          draggedLeadId,
          draggedLead.assigned_to,
          draggedLead.value,
          newStatus
        )

        if (commission) {
          toast.success(
            `Lead movido para ${PIPELINE_STAGES.find((s) => s.id === newStatus)?.title} - Comissão de R$ ${commission.amount.toFixed(2)} registrada!`
          )
        } else {
          toast.success(`Lead movido para ${PIPELINE_STAGES.find((s) => s.id === newStatus)?.title}`)
        }
      } else {
        toast.success(`Lead movido para ${PIPELINE_STAGES.find((s) => s.id === newStatus)?.title}`)
      }
    } catch (error) {
      console.error('Error updating lead:', error)
      await fetchLeads()
      toast.error('Erro ao atualizar lead')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    try {
      setUpdatingId(leadId)
      
      // Find lead before deletion for logging
      let leadTitle = 'Lead desconhecido'
      for (const [, statusLeads] of Object.entries(leads)) {
        const found = statusLeads.find((l) => l.id === leadId)
        if (found) {
          leadTitle = found.title
          break
        }
      }

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)

      if (error) throw error

      // Log the activity
      await logActivity(
        'delete',
        'lead',
        leadId,
        `Lead "${leadTitle}" foi deletado`,
        leadTitle
      )

      // Remove from local state
      const newLeads = { ...leads }
      for (const status in newLeads) {
        newLeads[status] = newLeads[status].filter((l) => l.id !== leadId)
      }
      setLeads(newLeads)

      toast.success('Lead deletado com sucesso')
    } catch (error) {
      console.error('Error deleting lead:', error)
      toast.error('Erro ao deletar lead')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleUpdateLead = async (updatedLead: Lead) => {
    try {
      setUpdatingId(updatedLead.id)
      
      // Find original lead for comparison
      let originalLead: Lead | null = null
      for (const [, statusLeads] of Object.entries(leads)) {
        const found = statusLeads.find((l) => l.id === updatedLead.id)
        if (found) {
          originalLead = found
          break
        }
      }

      const { error } = await supabase
        .from('leads')
        .update({
          title: updatedLead.title,
          description: updatedLead.description,
          value: updatedLead.value,
          expected_close_date: updatedLead.expected_close_date,
          probability: updatedLead.probability,
          updated_at: new Date().toISOString(),
        })
        .eq('id', updatedLead.id)

      if (error) throw error

      // Log the activity
      const changes = []
      if (originalLead?.title !== updatedLead.title) {
        changes.push(`título: "${originalLead?.title}" → "${updatedLead.title}"`)
      }
      if (originalLead?.value !== updatedLead.value) {
        changes.push(`valor: R$ ${originalLead?.value} → R$ ${updatedLead.value}`)
      }
      if (originalLead?.probability !== updatedLead.probability) {
        changes.push(`probabilidade: ${originalLead?.probability}% → ${updatedLead.probability}%`)
      }

      await logActivity(
        'update',
        'lead',
        updatedLead.id,
        `Lead "${updatedLead.title}" foi atualizado${changes.length > 0 ? ': ' + changes.join(', ') : ''}`,
        updatedLead.title
      )

      // Update local state
      const newLeads = { ...leads }
      for (const status in newLeads) {
        const index = newLeads[status].findIndex((l) => l.id === updatedLead.id)
        if (index !== -1) {
          newLeads[status][index] = updatedLead
        }
      }
      setLeads(newLeads)

      toast.success('Lead atualizado com sucesso')
    } catch (error) {
      console.error('Error updating lead:', error)
      toast.error('Erro ao atualizar lead')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Pipeline de Leads</h1>
          <Button
            onClick={onCreateLead}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Lead
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-8">
          {PIPELINE_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leads[stage.id]}
              onDeleteLead={handleDeleteLead}
              onUpdateLead={handleUpdateLead}
              isUpdating={updatingId !== null}
            />
          ))}
        </div>
      </div>
    </DndContext>
  )
}
