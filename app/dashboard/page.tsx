'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, FileText, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'
import { getRoleLabel } from '@/lib/permissions'

interface Stats {
  totalClients: number
  totalProcesses: number
  pendingTasks: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalProcesses: 0,
    pendingTasks: 0,
  })

  const { isAdmin, userId, role, user, loading: permLoading } = usePermissions()

  useEffect(() => {
    if (!permLoading && userId) {
      loadStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, userId, isAdmin])

  const loadStats = async () => {
    try {
      if (isAdmin) {
        // Admin sees all stats
        const [clientsRes, processesRes] = await Promise.all([
          supabase.from('clients').select('id', { count: 'exact', head: true }),
          supabase.from('processes').select('id', { count: 'exact', head: true }),
        ])

        setStats({
          totalClients: clientsRes.count || 0,
          totalProcesses: processesRes.count || 0,
          pendingTasks: 0,
        })
      } else if (userId) {
        // Comercial sees only their own stats
        const [clientsRes, processesRes] = await Promise.all([
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('created_by', userId),
          supabase.from('processes').select('id', { count: 'exact', head: true }),
        ])

        setStats({
          totalClients: clientsRes.count || 0,
          totalProcesses: processesRes.count || 0,
          pendingTasks: 0,
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Bem-vindo ao JurisIA CRM
              {user?.display_name || user?.full_name ? `, ${user.display_name || user.full_name}` : ''}
            </p>
          </div>
          {role && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {getRoleLabel(role)}
            </Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isAdmin ? 'Total de Clientes' : 'Meus Clientes'}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {isAdmin ? 'Clientes cadastrados' : 'Clientes que você cadastrou'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processos Ativos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProcesses}</div>
              <p className="text-xs text-muted-foreground mt-1">Processos em andamento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tarefas Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingTasks}</div>
              <p className="text-xs text-muted-foreground mt-1">Tarefas a fazer</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Próximas Funcionalidades</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Kanban de Processos
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Upload de Leads
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Cálculo de Comissões
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Relatórios Personalizados
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Timeline de Atividades
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
