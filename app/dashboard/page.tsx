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
  totalLeads: number
  pendingTasks: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalLeads: 0,
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
        const [clientsRes, leadsRes] = await Promise.all([
          supabase.from('clients').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id', { count: 'exact', head: true }),
        ])
        setStats({
          totalClients: clientsRes.count || 0,
          totalLeads: leadsRes.count || 0,
          pendingTasks: 0,
        })
      } else if (userId) {
        const [clientsRes, leadsRes] = await Promise.all([
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('created_by', userId),
          supabase.from('leads').select('id', { count: 'exact', head: true }),
        ])
        setStats({
          totalClients: clientsRes.count || 0,
          totalLeads: leadsRes.count || 0,
          pendingTasks: 0,
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const displayName = user?.full_name || user?.email || ''

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Bem-vindo ao JurisIA CRM{displayName ? `, ${displayName}` : ''}
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
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLeads}</div>
              <p className="text-xs text-muted-foreground mt-1">Leads no sistema</p>
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
            <CardTitle>Funcionalidades em Desenvolvimento 🚀</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Gestão completa de clientes
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Pipeline Kanban de Leads
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Sistema de Comissões
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Relatórios e Análises
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Integração com Supabase
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
