'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { ActivityFeed } from '@/components/activities/ActivityFeed'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Loader2, RefreshCw } from 'lucide-react'
import { fetchActivityLogs, ActivityLog, ActionType, EntityType } from '@/lib/activities'

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<ActionType | 'all'>('all')
  const [filterEntity, setFilterEntity] = useState<EntityType | 'all'>('all')

  useEffect(() => {
    loadActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterEntity])

  const loadActivities = async () => {
    try {
      setLoading(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters: any = {}

      if (filterType !== 'all') {
        filters.actionType = filterType
      }

      if (filterEntity !== 'all') {
        filters.entityType = filterEntity
      }

      filters.limit = 100

      const data = await fetchActivityLogs(filters)
      setActivities(data)
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    await loadActivities()
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Atividades</h1>
            <p className="text-muted-foreground mt-2">
              Timeline de todas as ações realizadas no sistema
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium">Tipo de Ação</label>
              <Select value={filterType} onValueChange={(value) => setFilterType(value as ActionType | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por tipo de ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="create">Criar</SelectItem>
                  <SelectItem value="update">Atualizar</SelectItem>
                  <SelectItem value="delete">Deletar</SelectItem>
                  <SelectItem value="move">Mover</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium">Entidade</label>
              <Select value={filterEntity} onValueChange={(value) => setFilterEntity(value as EntityType | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por entidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as entidades</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="commission">Comissão</SelectItem>
                  <SelectItem value="file">Arquivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Activity Feed */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              Total de atividades: <span className="font-semibold">{activities.length}</span>
            </div>
            <ActivityFeed activities={activities} groupByDate={true} />
          </>
        )}
      </div>
    </AppLayout>
  )
}
