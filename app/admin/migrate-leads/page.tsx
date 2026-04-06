'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'
import { AlertTriangle, CheckCircle2, Database, Loader2, ArrowRight, ShieldAlert, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface StatsData {
  total_leads: number
  leads_with_new_status: number
  status_breakdown: Record<string, number>
}

interface MigrationResult {
  success: boolean
  message: string
  before: number
  after: number
  migrated: number
  status_breakdown?: Record<string, number>
  executed_by?: string
  executed_at?: string
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  em_contato: 'Em Contato',
  em_negociacao: 'Em Negociação',
  negociacao_fechada: 'Negociação Fechada',
  lead_nao_qualificado: 'Lead Não Qualificado',
  prospeccao_futura: 'Prospecção Futura',
  new: '⚠️ new (inválido)',
}

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-gray-500',
  em_contato: 'bg-blue-500',
  em_negociacao: 'bg-yellow-500',
  negociacao_fechada: 'bg-green-500',
  lead_nao_qualificado: 'bg-red-500',
  prospeccao_futura: 'bg-purple-500',
  new: 'bg-orange-600',
}

export default function MigrateLeadsPage() {
  const { isAdmin, loading: permLoading } = usePermissions()
  const router = useRouter()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      setLoading(true)
      const headers = await getAuthHeaders()
      const res = await fetch('/api/admin/migrate-leads-status', { headers })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao carregar estatísticas')
      }
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar estatísticas')
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    if (!permLoading && !isAdmin) {
      router.push('/dashboard')
      return
    }
    if (!permLoading && isAdmin) {
      loadStats()
    }
  }, [permLoading, isAdmin, router, loadStats])

  const executeMigration = async () => {
    try {
      setMigrating(true)
      setShowConfirm(false)
      const headers = await getAuthHeaders()
      const res = await fetch('/api/admin/migrate-leads-status', {
        method: 'POST',
        headers,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erro na migração')
      }
      setResult(data)
      toast.success(data.message)
      // Reload stats
      await loadStats()
    } catch (error) {
      console.error('Migration error:', error)
      toast.error(error instanceof Error ? error.message : 'Erro na migração')
    } finally {
      setMigrating(false)
    }
  }

  if (permLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando...</span>
        </div>
      </AppLayout>
    )
  }

  if (!isAdmin) return null

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Migração de Status dos Leads</h1>
            <p className="text-muted-foreground mt-1">
              Ferramenta administrativa para corrigir leads com status inválido
            </p>
          </div>
          <Button variant="outline" onClick={loadStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Problem Description */}
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-500">
              <AlertTriangle className="h-5 w-5" />
              Problema Identificado
            </CardTitle>
            <CardDescription>
              Leads importados com status &quot;new&quot; que não é reconhecido pelo sistema.
              O status válido correspondente é &quot;backlog&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-sm">
              <Badge className="bg-orange-600">new (inválido)</Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge className="bg-gray-500">backlog (válido)</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Current Stats */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Estatísticas Atuais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Total de Leads</p>
                  <p className="text-3xl font-bold">{stats.total_leads}</p>
                </div>
                <div className={`p-4 rounded-lg ${stats.leads_with_new_status > 0 ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                  <p className="text-sm text-muted-foreground">Leads com status &quot;new&quot;</p>
                  <p className={`text-3xl font-bold ${stats.leads_with_new_status > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                    {stats.leads_with_new_status}
                  </p>
                </div>
              </div>

              {/* Status Breakdown */}
              {Object.keys(stats.status_breakdown).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Distribuição por Status</h4>
                  <div className="space-y-2">
                    {Object.entries(stats.status_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status] || 'bg-gray-400'}`} />
                            <span className="text-sm">{STATUS_LABELS[status] || status}</span>
                          </div>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Migration Action */}
        {stats && stats.leads_with_new_status > 0 && (
          <Card className="border-blue-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Executar Migração
              </CardTitle>
              <CardDescription>
                Esta ação irá alterar o status de {stats.leads_with_new_status} leads de &quot;new&quot; para &quot;backlog&quot;.
                Esta operação não pode ser desfeita.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showConfirm ? (
                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={migrating}
                  className="w-full"
                  size="lg"
                >
                  {migrating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Migrando...</>
                  ) : (
                    <>Iniciar Migração de {stats.leads_with_new_status} Leads</>
                  )}
                </Button>
              ) : (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-3">
                  <p className="font-medium text-destructive">
                    ⚠️ Confirmar migração de {stats.leads_with_new_status} leads?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Todos os leads com status &quot;new&quot; serão atualizados para &quot;backlog&quot;.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={executeMigration} disabled={migrating} variant="destructive">
                      {migrating ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executando...</>
                      ) : (
                        'Confirmar Migração'
                      )}
                    </Button>
                    <Button onClick={() => setShowConfirm(false)} variant="outline" disabled={migrating}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Card className={result.success ? 'border-green-500/50' : 'border-red-500/50'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <><CheckCircle2 className="h-5 w-5 text-green-500" /> Migração Concluída</>
                ) : (
                  <><AlertTriangle className="h-5 w-5 text-red-500" /> Erro na Migração</>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>{result.message}</p>
              {result.success && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Antes</p>
                    <p className="text-2xl font-bold text-orange-500">{result.before}</p>
                    <p className="text-xs">com status &quot;new&quot;</p>
                  </div>
                  <div className="p-3 rounded bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Migrados</p>
                    <p className="text-2xl font-bold text-green-500">{result.migrated}</p>
                    <p className="text-xs">para &quot;backlog&quot;</p>
                  </div>
                  <div className="p-3 rounded bg-muted text-center">
                    <p className="text-xs text-muted-foreground">Restantes</p>
                    <p className="text-2xl font-bold">{result.after}</p>
                    <p className="text-xs">com status &quot;new&quot;</p>
                  </div>
                </div>
              )}
              {result.executed_by && (
                <p className="text-xs text-muted-foreground">
                  Executado por: {result.executed_by} em {result.executed_at ? new Date(result.executed_at).toLocaleString('pt-BR') : ''}
                </p>
              )}

              {/* Updated breakdown */}
              {result.status_breakdown && Object.keys(result.status_breakdown).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 mt-4">Distribuição Atualizada</h4>
                  <div className="space-y-2">
                    {Object.entries(result.status_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status] || 'bg-gray-400'}`} />
                            <span className="text-sm">{STATUS_LABELS[status] || status}</span>
                          </div>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* All Clear */}
        {stats && stats.leads_with_new_status === 0 && !result && (
          <Card className="border-green-500/50">
            <CardContent className="flex items-center gap-3 py-6">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium text-green-500">Tudo certo!</p>
                <p className="text-sm text-muted-foreground">
                  Não há leads com status inválido. Todos os leads estão com status válido.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
