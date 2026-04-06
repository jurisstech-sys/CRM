'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users, FileText, DollarSign, TrendingUp, Target,
  BarChart3, Kanban, ArrowUpRight, ArrowDownRight, Loader2, RefreshCw
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'
import { getRoleLabel } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'

// Paleta oficial
const COLORS = {
  greenMain: '#346739',
  red: '#DB1A1A',
  blue: '#111FA2',
  greenSec: '#408A71',
  amber: '#FF9D00',
}

const STAGE_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  em_contato: 'Em Contato',
  em_negociacao: 'Em Negociação',
  negociacao_fechada: 'Negociação Fechada',
  lead_nao_qualificado: 'Lead Não Qualificado',
  prospeccao_futura: 'Prospecção Futura',
}

const STAGE_COLORS: Record<string, string> = {
  backlog: '#6b7280',
  em_contato: COLORS.blue,
  em_negociacao: COLORS.amber,
  negociacao_fechada: COLORS.greenMain,
  lead_nao_qualificado: COLORS.red,
  prospeccao_futura: '#a855f7',
}

interface GlobalStats {
  totalLeads: number
  totalClients: number
  activeLeads: number
  closedThisMonth: number
  revenueThisMonth: number
  commissionsThisMonth: number
  conversionRate: number
  activeUsers: number
  avgDealValue: number
  pendingTasks: number
}

interface StageCount {
  stage: string
  count: number
  value: number
}

interface UserRanking {
  user_id: string
  full_name: string
  closed: number
  revenue: number
  commission: number
  leadsInPipeline: number
}

interface CommissionHistory {
  month: string
  total: number
  count: number
  status: string
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value)

export default function DashboardPage() {
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalLeads: 0, totalClients: 0, activeLeads: 0, closedThisMonth: 0,
    revenueThisMonth: 0, commissionsThisMonth: 0, conversionRate: 0,
    activeUsers: 0, avgDealValue: 0, pendingTasks: 0,
  })
  const [stageCounts, setStageCounts] = useState<StageCount[]>([])
  const [userRanking, setUserRanking] = useState<UserRanking[]>([])
  const [commissionHistory, setCommissionHistory] = useState<CommissionHistory[]>([])
  const [funnelData, setFunnelData] = useState<{ name: string; value: number; fill: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [comerciais, setComerciais] = useState<{ id: string; full_name: string }[]>([])

  const { isAdmin, userId, role, user, loading: permLoading } = usePermissions()

  const loadDashboardData = useCallback(async () => {
    try {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      if (isAdmin) {
        // ─── Fetch comerciais list for filter ───
        const { data: comerciaisData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .order('full_name', { ascending: true })
        if (comerciaisData) {
          setComerciais(comerciaisData.map(u => ({
            id: u.id,
            full_name: u.full_name || u.email || 'Sem nome',
          })))
        }

        const filterByUser = selectedUser !== 'all'

        // ─── ADMIN DASHBOARD ───
        // Build queries with optional user filter
        let leadsCountQ = supabase.from('leads').select('id', { count: 'exact', head: true })
        let clientsCountQ = supabase.from('clients').select('id', { count: 'exact', head: true })
        let wonQ = supabase.from('leads').select('id, value').eq('status', 'negociacao_fechada').gte('updated_at', monthStart)
        let commQ = supabase.from('commissions').select('amount, status').gte('created_at', monthStart)
        let allLeadsQ = supabase.from('leads').select('id, status, value, assigned_to')
        let activitiesQ = supabase.from('activities').select('id', { count: 'exact', head: true }).eq('status', 'pending')

        if (filterByUser) {
          leadsCountQ = leadsCountQ.eq('assigned_to', selectedUser)
          clientsCountQ = clientsCountQ.eq('created_by', selectedUser)
          wonQ = wonQ.eq('assigned_to', selectedUser)
          commQ = commQ.eq('user_id', selectedUser)
          allLeadsQ = allLeadsQ.eq('assigned_to', selectedUser)
          activitiesQ = activitiesQ.eq('assigned_to', selectedUser)
        }

        const [
          leadsRes,
          clientsRes,
          usersRes,
          wonThisMonthRes,
          commissionsRes,
          allLeadsRes,
          activitiesRes,
        ] = await Promise.all([
          leadsCountQ,
          clientsCountQ,
          supabase.from('users').select('id', { count: 'exact', head: true }),
          wonQ,
          commQ,
          allLeadsQ,
          activitiesQ,
        ])

        const totalLeads = leadsRes.count || 0
        const wonLeads = wonThisMonthRes.data || []
        const closedThisMonth = wonLeads.length
        const revenueThisMonth = wonLeads.reduce((sum, l) => sum + (l.value || 0), 0)
        const commData = commissionsRes.data || []
        const commissionsTotal = commData.reduce((sum, c) => sum + (c.amount || 0), 0)

        // Stage counts
        const allLeads = allLeadsRes.data || []
        const stageMap: Record<string, { count: number; value: number }> = {}
        allLeads.forEach(lead => {
          const stage = lead.status || 'backlog'
          if (!stageMap[stage]) stageMap[stage] = { count: 0, value: 0 }
          stageMap[stage].count++
          stageMap[stage].value += lead.value || 0
        })

        const stageCountsArr: StageCount[] = Object.entries(stageMap).map(([stage, data]) => ({
          stage,
          count: data.count,
          value: data.value,
        }))

        const activeLeads = allLeads.filter(l =>
          l.status && !['negociacao_fechada', 'lead_nao_qualificado'].includes(l.status)
        ).length

        const conversionRate = totalLeads > 0 ? (closedThisMonth / totalLeads) * 100 : 0
        const avgDealValue = closedThisMonth > 0 ? revenueThisMonth / closedThisMonth : 0

        setGlobalStats({
          totalLeads,
          totalClients: clientsRes.count || 0,
          activeLeads,
          closedThisMonth,
          revenueThisMonth,
          commissionsThisMonth: commissionsTotal,
          conversionRate,
          activeUsers: usersRes.count || 0,
          avgDealValue,
          pendingTasks: activitiesRes.count || 0,
        })

        setStageCounts(stageCountsArr)

        // Build funnel data
        const funnelStages = ['backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura']
        const funnel = funnelStages.map(stage => ({
          name: STAGE_LABELS[stage] || stage,
          value: stageMap[stage]?.count || 0,
          fill: STAGE_COLORS[stage] || '#666',
        }))
        setFunnelData(funnel)

        // User ranking
        const { data: usersData } = await supabase.from('users').select('id, full_name')
        const userNameMap = new Map<string, string>()
        usersData?.forEach(u => userNameMap.set(u.id, u.full_name || 'Sem nome'))

        const rankingMap: Record<string, UserRanking> = {}
        allLeads.forEach(lead => {
          if (!lead.assigned_to) return
          if (!rankingMap[lead.assigned_to]) {
            rankingMap[lead.assigned_to] = {
              user_id: lead.assigned_to,
              full_name: userNameMap.get(lead.assigned_to) || 'Desconhecido',
              closed: 0,
              revenue: 0,
              commission: 0,
              leadsInPipeline: 0,
            }
          }
          if (lead.status === 'negociacao_fechada') {
            rankingMap[lead.assigned_to].closed++
            rankingMap[lead.assigned_to].revenue += lead.value || 0
          }
          if (lead.status && !['negociacao_fechada', 'lead_nao_qualificado'].includes(lead.status)) {
            rankingMap[lead.assigned_to].leadsInPipeline++
          }
        })

        // Add commission data
        commData.forEach((c: any) => {
          // We don't have user_id in this query, so skip for now
        })

        const ranking = Object.values(rankingMap).sort((a, b) => b.revenue - a.revenue)
        setUserRanking(ranking)

      } else if (userId) {
        // ─── COMERCIAL DASHBOARD ───
        const [
          myLeadsRes,
          myWonRes,
          myCommissionsRes,
          myActivitiesRes,
          myClientsRes,
        ] = await Promise.all([
          supabase.from('leads').select('id, status, value').eq('assigned_to', userId),
          supabase.from('leads').select('id, value').eq('assigned_to', userId).eq('status', 'negociacao_fechada').gte('updated_at', monthStart),
          supabase.from('commissions').select('amount, status, created_at').eq('user_id', userId).gte('created_at', monthStart),
          supabase.from('activities').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).eq('status', 'pending'),
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('created_by', userId),
        ])

        const myLeads = myLeadsRes.data || []
        const myWon = myWonRes.data || []
        const myComm = myCommissionsRes.data || []
        const closedThisMonth = myWon.length
        const revenueThisMonth = myWon.reduce((sum, l) => sum + (l.value || 0), 0)
        const commissionsTotal = myComm.reduce((sum, c) => sum + (c.amount || 0), 0)

        const stageMap: Record<string, { count: number; value: number }> = {}
        myLeads.forEach(lead => {
          const stage = lead.status || 'backlog'
          if (!stageMap[stage]) stageMap[stage] = { count: 0, value: 0 }
          stageMap[stage].count++
          stageMap[stage].value += lead.value || 0
        })

        const stageCountsArr: StageCount[] = Object.entries(stageMap).map(([stage, data]) => ({
          stage, count: data.count, value: data.value,
        }))

        const activeLeads = myLeads.filter(l => l.status && !['negociacao_fechada', 'lead_nao_qualificado'].includes(l.status)).length
        const conversionRate = myLeads.length > 0 ? (closedThisMonth / myLeads.length) * 100 : 0

        setGlobalStats({
          totalLeads: myLeads.length,
          totalClients: myClientsRes.count || 0,
          activeLeads,
          closedThisMonth,
          revenueThisMonth,
          commissionsThisMonth: commissionsTotal,
          conversionRate,
          activeUsers: 0,
          avgDealValue: closedThisMonth > 0 ? revenueThisMonth / closedThisMonth : 0,
          pendingTasks: myActivitiesRes.count || 0,
        })

        setStageCounts(stageCountsArr)

        // Funnel for own leads
        const funnelStages = ['backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura']
        const funnel = funnelStages.map(stage => ({
          name: STAGE_LABELS[stage] || stage,
          value: stageMap[stage]?.count || 0,
          fill: STAGE_COLORS[stage] || '#666',
        }))
        setFunnelData(funnel)

        // Commission history - last 6 months
        const months: CommissionHistory[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const mStart = d.toISOString()
          const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString()
          const { data: mComm } = await supabase
            .from('commissions')
            .select('amount, status')
            .eq('user_id', userId)
            .gte('created_at', mStart)
            .lte('created_at', mEnd)

          const mData = mComm || []
          months.push({
            month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            total: mData.reduce((s, c) => s + (c.amount || 0), 0),
            count: mData.length,
            status: mData.every(c => c.status === 'paid') ? 'paid' : 'pending',
          })
        }
        setCommissionHistory(months)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [isAdmin, userId, selectedUser])

  useEffect(() => {
    if (!permLoading && userId) {
      loadDashboardData()
    }
  }, [permLoading, userId, isAdmin, loadDashboardData])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadDashboardData()
  }

  const displayName = user?.full_name || user?.email || ''

  if (permLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando dashboard...</span>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin
                ? selectedUser !== 'all'
                  ? `Filtrando por: ${comerciais.find(c => c.id === selectedUser)?.full_name || 'Usuário'}`
                  : `Visão Global do CRM${displayName ? ` — ${displayName}` : ''}`
                : `Meus KPIs${displayName ? ` — ${displayName}` : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && comerciais.length > 0 && (
              <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v); }}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todos os Usuários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Usuários</SelectItem>
                  {comerciais.filter(u => u.id && String(u.id).trim() !== '').map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {role && (
              <Badge variant="outline" className="text-sm px-3 py-1">
                {getRoleLabel(role)}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* ─── KPI Cards Row 1 ─── */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KPICard
            title={isAdmin ? 'Total de Leads' : 'Meus Leads'}
            value={formatNumber(globalStats.totalLeads)}
            subtitle={isAdmin ? 'Leads cadastrados no sistema' : 'Leads atribuídos a você'}
            icon={<FileText className="h-5 w-5" />}
            color="blue"
          />
          <KPICard
            title={isAdmin ? 'Leads Ativos' : 'Em Pipeline'}
            value={formatNumber(globalStats.activeLeads)}
            subtitle="Em andamento no pipeline"
            icon={<Kanban className="h-5 w-5" />}
            color="amber"
          />
          <KPICard
            title="Vendas Fechadas/Mês"
            value={formatNumber(globalStats.closedThisMonth)}
            subtitle="Negociações ganhas este mês"
            icon={<Target className="h-5 w-5" />}
            color="green"
            trend={globalStats.closedThisMonth > 0 ? 'up' : undefined}
          />
          <KPICard
            title="Receita do Mês"
            value={formatCurrency(globalStats.revenueThisMonth)}
            subtitle="Valor total de vendas"
            icon={<DollarSign className="h-5 w-5" />}
            color="emerald"
            trend={globalStats.revenueThisMonth > 0 ? 'up' : undefined}
          />
        </div>

        {/* ─── KPI Cards Row 2 ─── */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Comissões do Mês"
            value={formatCurrency(globalStats.commissionsThisMonth)}
            subtitle={isAdmin ? 'Total a pagar em comissões' : 'Sua comissão acumulada'}
            icon={<DollarSign className="h-5 w-5" />}
            color="purple"
          />
          <KPICard
            title="Taxa de Conversão"
            value={`${globalStats.conversionRate.toFixed(2)}%`}
            subtitle="Leads → Vendas fechadas"
            icon={<TrendingUp className="h-5 w-5" />}
            color="green"
          />
          {isAdmin ? (
            <KPICard
              title="Usuários Ativos"
              value={formatNumber(globalStats.activeUsers)}
              subtitle="Usuários no sistema"
              icon={<Users className="h-5 w-5" />}
              color="blue"
            />
          ) : (
            <KPICard
              title="Meus Clientes"
              value={formatNumber(globalStats.totalClients)}
              subtitle="Clientes que você cadastrou"
              icon={<Users className="h-5 w-5" />}
              color="blue"
            />
          )}
          <KPICard
            title={isAdmin ? 'Ticket Médio' : 'Tarefas Pendentes'}
            value={isAdmin ? formatCurrency(globalStats.avgDealValue) : formatNumber(globalStats.pendingTasks)}
            subtitle={isAdmin ? 'Valor médio por venda' : 'Atividades a realizar'}
            icon={isAdmin ? <BarChart3 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
            color="amber"
          />
        </div>

        {/* ─── Charts Row ─── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Funnel / Pipeline por Estágio */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isAdmin ? 'Funil Global de Conversão' : 'Meu Pipeline por Estágio'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#888" />
                    <YAxis dataKey="name" type="category" width={100} stroke="#888" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff' }}
                      formatter={(value: number) => [formatNumber(value), 'Leads']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {funnelData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Sem dados de leads disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          {/* Volume por Estágio (Pie) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Estágio</CardTitle>
            </CardHeader>
            <CardContent>
              {stageCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stageCounts.map(s => ({
                        name: STAGE_LABELS[s.stage] || s.stage,
                        value: s.count,
                        fill: STAGE_COLORS[s.stage] || '#666',
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {stageCounts.map((s, i) => (
                        <Cell key={i} fill={STAGE_COLORS[s.stage] || '#666'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Admin: Ranking de Performance ─── */}
        {isAdmin && userRanking.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🏆 Ranking de Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Pos.</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Comercial</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Leads Ativos</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Fechamentos</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRanking.map((user, idx) => (
                      <tr key={user.user_id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <span className={`font-bold ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-700' : ''}`}>
                            {idx + 1}º
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium">{user.full_name}</td>
                        <td className="py-3 px-4 text-right">{user.leadsInPipeline}</td>
                        <td className="py-3 px-4 text-right">
                          <Badge variant={user.closed > 0 ? 'default' : 'secondary'}>{user.closed}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-medium" style={{ color: COLORS.greenMain }}>
                          {formatCurrency(user.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Admin: Revenue Chart ─── */}
        {isAdmin && stageCounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Volume de Vendas por Estágio (R$)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stageCounts.filter(s => s.value > 0).map(s => ({
                  name: STAGE_LABELS[s.stage] || s.stage,
                  valor: s.value,
                  fill: STAGE_COLORS[s.stage] || '#666',
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff' }}
                    formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {stageCounts.filter(s => s.value > 0).map((s, i) => (
                      <Cell key={i} fill={STAGE_COLORS[s.stage] || '#666'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ─── Comercial: Commission History ─── */}
        {!isAdmin && commissionHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">📊 Histórico de Comissões (últimos 6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={commissionHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff' }}
                    formatter={(value: number) => [formatCurrency(value), 'Comissão']}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={COLORS.greenMain}
                    fill={COLORS.greenSec}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
              {/* Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground">Mês</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Vendas</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Comissão</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionHistory.map((m, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-3 capitalize">{m.month}</td>
                        <td className="py-2 px-3 text-right">{m.count}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCurrency(m.total)}</td>
                        <td className="py-2 px-3 text-right">
                          {m.status === 'paid' ? (
                            <Badge className="bg-green-600">Pago ✅</Badge>
                          ) : (
                            <Badge variant="secondary">Aberto ⏳</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Stage Details Table ─── */}
        {stageCounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhamento por Estágio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                {['backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura'].map(stage => {
                  const data = stageCounts.find(s => s.stage === stage)
                  return (
                    <div
                      key={stage}
                      className="rounded-lg p-4 text-center"
                      style={{ borderTop: `3px solid ${STAGE_COLORS[stage] || '#666'}`, backgroundColor: 'rgba(255,255,255,0.03)' }}
                    >
                      <p className="text-xs text-muted-foreground mb-1">{STAGE_LABELS[stage]}</p>
                      <p className="text-2xl font-bold">{data?.count || 0}</p>
                      {data && data.value > 0 && (
                        <p className="text-xs mt-1" style={{ color: STAGE_COLORS[stage] }}>
                          {formatCurrency(data.value)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}

// ─── KPI Card Component ───
function KPICard({
  title, value, subtitle, icon, color, trend,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'amber' | 'emerald' | 'purple' | 'red'
  trend?: 'up' | 'down'
}) {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    amber: 'bg-amber-500/10 text-amber-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    purple: 'bg-purple-500/10 text-purple-500',
    red: 'bg-red-500/10 text-red-500',
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-lg ${colorMap[color]}`}>
            {icon}
          </div>
          {trend && (
            <span className={trend === 'up' ? 'text-green-500' : 'text-red-500'}>
              {trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{title}</p>
        <p className="text-xs text-muted-foreground/70">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
