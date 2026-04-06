'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCorners,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  CollisionDetection,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { Lead } from './LeadCard'
import { LeadModal } from './LeadModal'
import { Loader2, Plus, Trash2, CheckSquare, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { createCommissionOnWin } from '@/lib/commissions'
import { logActivity } from '@/lib/activities'
import KanbanColumn from './KanbanColumn'

interface KanbanBoardProps {
  onCreateLead?: () => void
  isAdminUser?: boolean
  canDeleteLeads?: boolean
  currentUserId?: string | null
}

interface PipelineData {
  [key: string]: Lead[]
}

const PIPELINE_STAGES = [
  { id: 'backlog', title: 'Backlog', color: 'bg-gray-500' },
  { id: 'em_contato', title: 'Em Contato', color: 'bg-blue-500' },
  { id: 'em_negociacao', title: 'Em Negociação', color: 'bg-yellow-500' },
  { id: 'negociacao_fechada', title: 'Negociação Fechada', color: 'bg-green-500' },
  { id: 'lead_nao_qualificado', title: 'Lead Não Qualificado', color: 'bg-red-500' },
  { id: 'prospeccao_futura', title: 'Prospecção Futura', color: 'bg-purple-500' },
]

export function KanbanBoard({ onCreateLead, isAdminUser = false, canDeleteLeads = false, currentUserId }: KanbanBoardProps) {
  const [leads, setLeads] = useState<PipelineData>({
    backlog: [],
    em_contato: [],
    em_negociacao: [],
    negociacao_fechada: [],
    lead_nao_qualificado: [],
    prospeccao_futura: [],
  })
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Selection state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [showCheckboxes, setShowCheckboxes] = useState(false)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)

  // Modal state
  const [modalLead, setModalLead] = useState<Lead | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Active drag state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  // Custom collision detection: prioritize droppable columns, then fall back to closest corners
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // First try pointerWithin - best for dropping into columns
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      // Prefer column collisions over card collisions
      const columnCollision = pointerCollisions.find(c => 
        PIPELINE_STAGES.some(s => s.id === c.id)
      )
      if (columnCollision) return [columnCollision]
      return pointerCollisions
    }
    // Fall back to rectIntersection
    const rectCollisions = rectIntersection(args)
    if (rectCollisions.length > 0) {
      const columnCollision = rectCollisions.find(c => 
        PIPELINE_STAGES.some(s => s.id === c.id)
      )
      if (columnCollision) return [columnCollision]
      return rectCollisions
    }
    // Last resort
    return closestCorners(args)
  }, [])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminUser, currentUserId])

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.')
        return
      }

      const stageIds = PIPELINE_STAGES.map(s => s.id).join(',')
      const response = await fetch(`/api/leads?status=${stageIds}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar leads')
      }

      const result = await response.json()
      const data = result.leads

      const grouped: PipelineData = {}
      PIPELINE_STAGES.forEach(s => { grouped[s.id] = [] })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          email1: lead.email1,
          email2: lead.email2,
          email3: lead.email3,
          phone1: lead.phone1,
          phone2: lead.phone2,
          created_at: lead.created_at,
          updated_at: lead.updated_at,
          created_by: lead.created_by,
          updated_by: lead.updated_by,
          client_name: lead.clients?.name,
          client_email: lead.clients?.email,
        }

        if (grouped[lead.status]) {
          grouped[lead.status].push(mappedLead)
        }
      })

      setLeads(grouped)
    } catch (error) {
      console.error('Error fetching leads:', error)
      toast.error('Erro ao carregar leads')
    } finally {
      setLoading(false)
    }
  }, [isAdminUser, currentUserId])

  // ---- Lead click -> open modal ----
  const handleLeadClick = (lead: Lead) => {
    if (showCheckboxes) return // Don't open modal when in selection mode
    setModalLead(lead)
    setIsModalOpen(true)
  }

  // ---- Selection handlers ----
  const handleSelectLead = (id: string, selected: boolean) => {
    setSelectedLeads((prev) =>
      selected ? [...prev, id] : prev.filter((lid) => lid !== id)
    )
  }

  const handleSelectAll = () => {
    const allIds = Object.values(leads).flat().map((l) => l.id)
    if (selectedLeads.length === allIds.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(allIds)
    }
  }

  const toggleSelectionMode = () => {
    if (showCheckboxes) {
      setShowCheckboxes(false)
      setSelectedLeads([])
    } else {
      setShowCheckboxes(true)
    }
  }

  // ---- Bulk delete ----
  const handleDeleteSelected = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Nenhum lead selecionado')
      return
    }

    if (!window.confirm(`Tem certeza que deseja excluir ${selectedLeads.length} lead(s)? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      setIsDeletingBatch(true)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        toast.error('Sessão expirada')
        return
      }

      const response = await fetch('/api/leads/delete-batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedLeads }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erro ao excluir')
      }

      const result = await response.json()

      // Log activity
      await logActivity(
        'delete',
        'lead',
        'batch',
        `${result.deleted} leads excluídos em massa`,
        'Exclusão em massa'
      )

      toast.success(`${result.deleted} lead(s) excluído(s) com sucesso`)
      setSelectedLeads([])
      setShowCheckboxes(false)
      await fetchLeads()
    } catch (error) {
      console.error('Error batch deleting:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir leads')
    } finally {
      setIsDeletingBatch(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    const draggedLeadId = active.id as string

    let newStatus = over.id as string
    const isStage = PIPELINE_STAGES.some((s) => s.id === newStatus)

    if (!isStage) {
      const overData = over.data?.current
      if (overData?.type === 'Column') {
        newStatus = overData.stage
      } else {
        let foundStatus = ''
        for (const [status, statusLeads] of Object.entries(leads)) {
          if (statusLeads.find((l) => l.id === newStatus)) {
            foundStatus = status
            break
          }
        }
        if (foundStatus) {
          newStatus = foundStatus
        } else {
          return
        }
      }
    }

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

    try {
      setUpdatingId(draggedLeadId)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // When moving from backlog, assign the lead to the user who moved it
      const updatePayload: Record<string, string> = { id: draggedLeadId, status: newStatus }
      if (oldStatus === 'backlog' && newStatus !== 'backlog') {
        updatePayload.assigned_to = currentUserId || ''
      }

      const response = await fetch('/api/leads', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        await fetchLeads()
        toast.error('Erro ao atualizar lead')
        return
      }

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

      if (newStatus === 'negociacao_fechada' && draggedLead.assigned_to && draggedLead.value) {
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
    if (!canDeleteLeads) {
      toast.error('Você não tem permissão para deletar leads')
      return
    }

    try {
      setUpdatingId(leadId)

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

      await logActivity(
        'delete',
        'lead',
        leadId,
        `Lead "${leadTitle}" foi deletado`,
        leadTitle
      )

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

      let originalLead: Lead | null = null
      let oldStatus = ''
      for (const [status, statusLeads] of Object.entries(leads)) {
        const found = statusLeads.find((l) => l.id === updatedLead.id)
        if (found) {
          originalLead = found
          oldStatus = status
          break
        }
      }

      const newStatus = updatedLead.status
      const statusChanged = oldStatus !== '' && oldStatus !== newStatus

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // Build update payload — include status so column changes are persisted
      const updatePayload: Record<string, unknown> = {
        id: updatedLead.id,
        title: updatedLead.title,
        description: updatedLead.description,
        value: updatedLead.value,
        expected_close_date: updatedLead.expected_close_date,
        probability: updatedLead.probability,
        email1: updatedLead.email1,
        email2: updatedLead.email2,
        email3: updatedLead.email3,
        phone1: updatedLead.phone1,
        phone2: updatedLead.phone2,
        status: newStatus,
      }

      // When moving from backlog, assign the lead to the user who moved it
      if (statusChanged && oldStatus === 'backlog' && newStatus !== 'backlog') {
        updatePayload.assigned_to = currentUserId || ''
      }

      const response = await fetch('/api/leads', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) throw new Error('Erro ao atualizar')

      // Log activity
      const changes = []
      if (originalLead?.title !== updatedLead.title) {
        changes.push(`título: "${originalLead?.title}" → "${updatedLead.title}"`)
      }
      if (originalLead?.value !== updatedLead.value) {
        changes.push(`valor: R$ ${originalLead?.value} → R$ ${updatedLead.value}`)
      }
      if (statusChanged) {
        const oldStatusTitle = PIPELINE_STAGES.find((s) => s.id === oldStatus)?.title || oldStatus
        const newStatusTitle = PIPELINE_STAGES.find((s) => s.id === newStatus)?.title || newStatus
        changes.push(`status: "${oldStatusTitle}" → "${newStatusTitle}"`)
      }

      await logActivity(
        statusChanged ? 'move' : 'update',
        'lead',
        updatedLead.id,
        `Lead "${updatedLead.title}" foi ${statusChanged ? 'movido' : 'atualizado'}${changes.length > 0 ? ': ' + changes.join(', ') : ''}`,
        updatedLead.title,
        statusChanged ? (PIPELINE_STAGES.find((s) => s.id === oldStatus)?.title || oldStatus) : undefined,
        statusChanged ? (PIPELINE_STAGES.find((s) => s.id === newStatus)?.title || newStatus) : undefined
      )

      // Handle commission on win via modal status change
      if (statusChanged && newStatus === 'negociacao_fechada' && updatedLead.assigned_to && updatedLead.value) {
        const commission = await createCommissionOnWin(
          updatedLead.id,
          updatedLead.assigned_to,
          updatedLead.value,
          newStatus
        )
        if (commission) {
          toast.success(
            `Lead movido para Negociação Fechada - Comissão de R$ ${commission.amount.toFixed(2)} registrada!`
          )
        } else {
          toast.success('Lead atualizado com sucesso')
        }
      } else {
        toast.success('Lead atualizado com sucesso')
      }

      // Update local state — move lead between columns if status changed
      const newLeads = { ...leads }
      if (statusChanged && oldStatus && PIPELINE_STAGES.find((s) => s.id === newStatus)) {
        // Remove from old column
        newLeads[oldStatus] = newLeads[oldStatus].filter((l) => l.id !== updatedLead.id)
        // Add to new column
        newLeads[newStatus] = [updatedLead, ...newLeads[newStatus]]
      } else {
        // Just update in place
        for (const status in newLeads) {
          const index = newLeads[status].findIndex((l) => l.id === updatedLead.id)
          if (index !== -1) {
            newLeads[status][index] = updatedLead
          }
        }
      }
      setLeads(newLeads)
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

  const totalLeads = Object.values(leads).flat().length

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={(event: DragStartEvent) => setActiveId(event.active.id)}
        onDragEnd={(event: DragEndEvent) => {
          setActiveId(null)
          handleDragEnd(event)
        }}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl font-bold text-white">Pipeline de Leads</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Selection mode toggle */}
              {canDeleteLeads && totalLeads > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectionMode}
                    className={`border-slate-700 ${showCheckboxes ? 'bg-blue-600/20 text-blue-300' : ''}`}
                  >
                    {showCheckboxes ? (
                      <><Square className="w-4 h-4 mr-2" />Cancelar Seleção</>
                    ) : (
                      <><CheckSquare className="w-4 h-4 mr-2" />Selecionar</>
                    )}
                  </Button>

                  {showCheckboxes && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        className="border-slate-700"
                      >
                        {selectedLeads.length === totalLeads ? 'Desmarcar Todos' : 'Selecionar Todos'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelected}
                        disabled={selectedLeads.length === 0 || isDeletingBatch}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isDeletingBatch ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Excluir ({selectedLeads.length})
                      </Button>
                    </>
                  )}
                </>
              )}

              <Button
                onClick={onCreateLead}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Lead
              </Button>
            </div>
          </div>

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 pb-8">
            {PIPELINE_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={leads[stage.id]}
                onDeleteLead={canDeleteLeads ? handleDeleteLead : undefined}
                onUpdateLead={handleUpdateLead}
                isUpdating={updatingId !== null}
                onLeadClick={handleLeadClick}
                selectedLeads={selectedLeads}
                onSelectLead={handleSelectLead}
                showCheckboxes={showCheckboxes}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {/* Lead Detail Modal */}
      <LeadModal
        lead={modalLead}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setModalLead(null)
        }}
        onSave={handleUpdateLead}
        onDelete={canDeleteLeads ? handleDeleteLead : undefined}
        canDelete={canDeleteLeads}
      />
    </>
  )
}
