'use client'

import { useMemo } from 'react'
import { format, formatDistance } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Move,
  Users,
  TrendingUp,
  FileText,
  Clock
} from 'lucide-react'
import { ActivityLog, ActionType, EntityType } from '@/lib/activities'

interface ActivityFeedProps {
  activities: ActivityLog[]
  groupByDate?: boolean
}

/**
 * Get icon for action type
 */
function getActionIcon(actionType: ActionType) {
  switch (actionType) {
    case 'create':
      return <Plus className="w-4 h-4" />
    case 'update':
      return <Edit2 className="w-4 h-4" />
    case 'delete':
      return <Trash2 className="w-4 h-4" />
    case 'move':
      return <Move className="w-4 h-4" />
    default:
      return <Clock className="w-4 h-4" />
  }
}

/**
 * Get color for action type
 */
function getActionColor(actionType: ActionType): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (actionType) {
    case 'create':
      return 'default'
    case 'update':
      return 'secondary'
    case 'delete':
      return 'destructive'
    case 'move':
      return 'outline'
    default:
      return 'default'
  }
}

/**
 * Get label for action type
 */
function getActionLabel(actionType: ActionType): string {
  switch (actionType) {
    case 'create':
      return 'Criado'
    case 'update':
      return 'Atualizado'
    case 'delete':
      return 'Deletado'
    case 'move':
      return 'Movido'
    default:
      return actionType
  }
}

/**
 * Get icon and label for entity type
 */
function getEntityIcon(entityType: EntityType) {
  switch (entityType) {
    case 'client':
      return <Users className="w-4 h-4" />
    case 'lead':
      return <TrendingUp className="w-4 h-4" />
    case 'commission':
      return <TrendingUp className="w-4 h-4" />
    case 'file':
      return <FileText className="w-4 h-4" />
    default:
      return <Clock className="w-4 h-4" />
  }
}

function getEntityLabel(entityType: EntityType): string {
  switch (entityType) {
    case 'client':
      return 'Cliente'
    case 'lead':
      return 'Lead'
    case 'commission':
      return 'Comissão'
    case 'file':
      return 'Arquivo'
    default:
      return entityType
  }
}

/**
 * Group activities by date
 */
function groupActivitiesByDate(activities: ActivityLog[]): Map<string, ActivityLog[]> {
  const grouped = new Map<string, ActivityLog[]>()

  activities.forEach((activity) => {
    const date = activity.created_at ? format(new Date(activity.created_at), 'yyyy-MM-dd', { locale: ptBR }) : 'Data desconhecida'
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date)!.push(activity)
  })

  return grouped
}

export function ActivityFeed({ activities, groupByDate = true }: ActivityFeedProps) {
  const groupedActivities = useMemo(() => {
    return groupByDate ? groupActivitiesByDate(activities) : new Map([['', activities]])
  }, [activities, groupByDate])

  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Nenhuma atividade registrada ainda</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {Array.from(groupedActivities.entries()).map(([date, dayActivities]) => (
        <div key={date} className="space-y-4">
          {groupByDate && (
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold text-muted-foreground">
                {date !== 'Data desconhecida' ? format(new Date(date), 'EEEE, d MMMM yyyy', { locale: ptBR }) : date}
              </div>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          <div className="space-y-3">
            {dayActivities.map((activity) => (
              <Card
                key={activity.id}
                className="p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center">
                    <div className="p-2 rounded-full bg-primary/10">
                      {getActionIcon(activity.action_type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getActionColor(activity.action_type)}>
                          {getActionLabel(activity.action_type)}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          {getEntityIcon(activity.entity_type)}
                          {getEntityLabel(activity.entity_type)}
                        </Badge>
                      </div>
                      {activity.created_at && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistance(new Date(activity.created_at), new Date(), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-foreground mb-2">
                      {activity.description}
                    </p>

                    {/* Entity name */}
                    {activity.entity_name && (
                      <p className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium">{activity.entity_name}</span>
                      </p>
                    )}

                    {/* Value changes */}
                    {(activity.old_value || activity.new_value) && (
                      <div className="mt-2 text-xs space-y-1 bg-muted/50 p-2 rounded">
                        {activity.old_value && (
                          <div>
                            <span className="text-muted-foreground">Anterior: </span>
                            <span className="line-through text-red-600">{activity.old_value}</span>
                          </div>
                        )}
                        {activity.new_value && (
                          <div>
                            <span className="text-muted-foreground">Novo: </span>
                            <span className="font-medium text-green-600">{activity.new_value}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    {activity.created_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(activity.created_at), 'HH:mm:ss', { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
