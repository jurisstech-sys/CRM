'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Settings, Save, Loader2, Users, ArrowLeft, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Pipeline stages matching the CRM system
const PIPELINE_STAGES = [
  { key: 'backlog', label: 'Backlog', color: '#6b7280' },
  { key: 'em_contato', label: 'Em Contato', color: '#3b82f6' },
  { key: 'em_negociacao', label: 'Em Negociação', color: '#eab308' },
  { key: 'negociacao_fechada', label: 'Negociação Fechada', color: '#22c55e' },
  { key: 'lead_nao_qualificado', label: 'Lead Não Qualificado', color: '#ef4444' },
  { key: 'prospeccao_futura', label: 'Prospecção Futura', color: '#a855f7' },
]

interface CommissionConfig {
  user_id: string
  stage: string
  percentage: number
}

interface UserInfo {
  id: string
  full_name: string
  email: string
  role: string
  commission_rate: number
}

export default function CommissionConfigPage() {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [configs, setConfigs] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const { isAdmin, loading: permLoading } = usePermissions()
  const router = useRouter()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch users via API route (uses service role to bypass RLS)
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      let usersData: UserInfo[] = []

      if (token) {
        try {
          const usersRes = await fetch('/api/users/list', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (usersRes.ok) {
            const usersResult = await usersRes.json()
            usersData = usersResult.users || []
          } else {
            console.error('Error fetching users from API, trying direct query...')
          }
        } catch (apiError) {
          console.error('API fetch failed:', apiError)
        }
      }

      // Fallback: direct query if API fails
      if (usersData.length === 0) {
        const { data: directUsers, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, email, role, commission_rate')
          .order('full_name', { ascending: true })

        if (usersError) {
          console.error('Error fetching users:', usersError)
          toast.error('Erro ao carregar usuários')
          return
        }
        usersData = directUsers || []
      }

      console.log('Usuários encontrados:', usersData)
      setUsers(usersData)

      // Fetch existing commission configs
      try {
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token

        if (token) {
          const res = await fetch('/api/commissions/config', {
            headers: { Authorization: `Bearer ${token}` },
          })

          if (res.ok) {
            const result = await res.json()
            const configData = result.data || []

            // Build config map: { user_id: { stage: percentage } }
            const configMap: Record<string, Record<string, number>> = {}
            configData.forEach((c: any) => {
              if (!configMap[c.user_id]) configMap[c.user_id] = {}
              configMap[c.user_id][c.stage] = c.percentage
            })

            // Initialize missing users with default values from commission_rate or stage defaults
            ;(usersData || []).forEach(user => {
              if (!configMap[user.id]) {
                configMap[user.id] = {}
              }
              PIPELINE_STAGES.forEach(stage => {
                if (configMap[user.id][stage.key] === undefined) {
                  // Default: use user's commission_rate for 'negociacao_fechada', 0 for others
                  configMap[user.id][stage.key] = stage.key === 'negociacao_fechada'
                    ? (user.commission_rate || 0)
                    : 0
                }
              })
            })

            setConfigs(configMap)
          }
        }
      } catch (fetchError) {
        console.error('Error fetching commission configs:', fetchError)
        // Initialize with defaults
        const configMap: Record<string, Record<string, number>> = {}
        ;(usersData || []).forEach(user => {
          configMap[user.id] = {}
          PIPELINE_STAGES.forEach(stage => {
            configMap[user.id][stage.key] = stage.key === 'negociacao_fechada'
              ? (user.commission_rate || 0)
              : 0
          })
        })
        setConfigs(configMap)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading) {
      if (!isAdmin) {
        router.push('/dashboard')
        return
      }
      loadData()
    }
  }, [permLoading, isAdmin, router, loadData])

  const handlePercentageChange = (userId: string, stage: string, value: string) => {
    const numValue = parseFloat(value) || 0
    setConfigs(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [stage]: Math.min(Math.max(numValue, 0), 100),
      },
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Build configs array
      const configsToSave: CommissionConfig[] = []
      Object.entries(configs).forEach(([userId, stages]) => {
        Object.entries(stages).forEach(([stage, percentage]) => {
          configsToSave.push({
            user_id: userId,
            stage,
            percentage,
          })
        })
      })

      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.')
        return
      }

      const res = await fetch('/api/commissions/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ configs: configsToSave }),
      })

      if (res.ok) {
        toast.success('Configurações de comissão salvas com sucesso!')
        setHasChanges(false)

        // Also update each user's commission_rate in the users table (won stage rate)
        for (const user of users) {
          const wonRate = configs[user.id]?.negociacao_fechada ?? 0
          if (wonRate !== user.commission_rate) {
            await supabase
              .from('users')
              .update({ commission_rate: wonRate })
              .eq('id', user.id)
          }
        }
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erro ao salvar configurações')
      }
    } catch (error) {
      console.error('Error saving configs:', error)
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const applyToAll = (stage: string, percentage: number) => {
    setConfigs(prev => {
      const updated = { ...prev }
      users.forEach(user => {
        if (!updated[user.id]) updated[user.id] = {}
        updated[user.id][stage] = percentage
      })
      return updated
    })
    setHasChanges(true)
    toast.info(`${percentage}% aplicado para todos os comerciais nesta etapa`)
  }

  if (permLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando configurações...</span>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/commissions">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Settings className="h-7 w-7" />
                Configuração de Comissões
              </h1>
              <p className="text-muted-foreground mt-1">
                Defina o percentual de comissão por comercial e etapa do pipeline
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="outline" className="border-amber-500 text-amber-500">
                <AlertCircle className="h-3 w-3 mr-1" />
                Alterações não salvas
              </Badge>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Como funciona o cálculo de comissão</p>
                <p className="text-sm text-muted-foreground mt-1">
                  A comissão é calculada automaticamente quando um lead avança para uma etapa.
                  O valor é: <strong>Valor do Deal × Percentual da Etapa ÷ 100</strong>.
                  A taxa aplicada é a configurada no momento da venda (não retroativa).
                  A etapa &quot;Negociação Fechada&quot; é a principal para comissionamento em vendas fechadas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users & Commission Config */}
        {users.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhum usuário encontrado</p>
              <p className="text-sm text-muted-foreground">Crie usuários para configurar comissões</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Stage Headers - Quick Apply */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aplicar em Massa por Etapa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-3">
                  {PIPELINE_STAGES.map(stage => (
                    <div key={stage.key} className="text-center">
                      <p className="text-xs font-medium mb-2" style={{ color: stage.color }}>
                        {stage.label}
                      </p>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="%"
                          className="text-center text-xs h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = parseFloat((e.target as HTMLInputElement).value)
                              if (!isNaN(val)) applyToAll(stage.key, val)
                            }
                          }}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Enter para aplicar</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Per-User Configuration */}
            {users.map(user => (
              <Card key={user.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{user.full_name || 'Sem nome'}</CardTitle>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role === 'admin' ? 'Admin' : 'Comercial'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {PIPELINE_STAGES.map(stage => (
                      <div key={stage.key}>
                        <label
                          className="text-xs font-medium mb-1.5 block"
                          style={{ color: stage.color }}
                        >
                          {stage.label}
                        </label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={configs[user.id]?.[stage.key] ?? 0}
                            onChange={(e) => handlePercentageChange(user.id, stage.key, e.target.value)}
                            className="text-center h-9"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Current commission rate info */}
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      Taxa atual no cadastro: <strong>{user.commission_rate || 0}%</strong>
                      {configs[user.id]?.negociacao_fechada !== undefined && configs[user.id]?.negociacao_fechada !== user.commission_rate && (
                        <span className="text-amber-500 ml-2">
                          → Será atualizada para {configs[user.id]?.negociacao_fechada}% ao salvar
                        </span>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Floating Save Button */}
        {hasChanges && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="bg-green-600 hover:bg-green-700 shadow-lg"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Save className="h-5 w-5 mr-2" />
              )}
              Salvar Todas as Configurações
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
