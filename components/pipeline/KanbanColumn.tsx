'use client'

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LeadCard, Lead } from './LeadCard'

interface Stage {
  id: string
  title: string
  color: string
}

interface KanbanColumnProps {
  stage: Stage
  leads: Lead[]
  onDeleteLead?: (id: string) => void
  onUpdateLead: (lead: Lead) => void
  isUpdating: boolean
  onLeadClick?: (lead: Lead) => void
  selectedLeads?: string[]
  onSelectLead?: (id: string, selected: boolean) => void
  showCheckboxes?: boolean
}

function DroppableColumn({
  stage,
  leads,
  onDeleteLead,
  isUpdating,
  onLeadClick,
  selectedLeads = [],
  onSelectLead,
  showCheckboxes,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      type: 'Column',
      stage: stage.id,
    },
  })

  const leadsIds = leads.map((lead) => lead.id)
  const selectedCount = leads.filter((l) => selectedLeads.includes(l.id)).length

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-4 min-h-96 transition-colors ${
        isOver ? 'bg-slate-700/50' : 'bg-slate-900/50'
      } border border-slate-700`}
    >
      {/* Column Header */}
      <div className="mb-4 pb-3 border-b border-slate-700">
        <h2 className="font-semibold text-white text-sm">
          {stage.title}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
          {selectedCount > 0 && (
            <span className="text-blue-400 ml-1">({selectedCount} selecionados)</span>
          )}
        </p>
      </div>

      {/* Sortable Leads */}
      <SortableContext
        items={leadsIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {leads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Nenhum lead nesta coluna</p>
            </div>
          ) : (
            leads.map((lead) => (
              <div key={lead.id} className="flex">
                <SortableLeadCard
                  lead={lead}
                  onDelete={onDeleteLead}
                  isUpdating={isUpdating}
                  onLeadClick={onLeadClick}
                  isSelected={selectedLeads.includes(lead.id)}
                  onSelectLead={onSelectLead}
                  showCheckbox={showCheckboxes}
                />
              </div>
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

interface SortableLeadCardProps {
  lead: Lead
  onDelete?: (id: string) => void
  isUpdating: boolean
  onLeadClick?: (lead: Lead) => void
  isSelected?: boolean
  onSelectLead?: (id: string, selected: boolean) => void
  showCheckbox?: boolean
}

function SortableLeadCard({ lead, onDelete, onLeadClick, isSelected, onSelectLead, showCheckbox }: SortableLeadCardProps) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: {
      type: 'LeadCard',
      lead,
    },
  })

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="w-full">
      <LeadCard
        lead={lead}
        onDelete={onDelete}
        onClick={onLeadClick}
        isSelected={isSelected}
        onSelect={onSelectLead}
        showCheckbox={showCheckbox}
      />
    </div>
  )
}

export default DroppableColumn
