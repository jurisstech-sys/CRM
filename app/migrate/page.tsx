'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface MigrationDetail {
  status: string
  from: string
  to: string
  count: number
}

interface MigrationResult {
  success: boolean
  message: string
  totalMigrated: number
  details: MigrationDetail[]
  error?: string
}

export default function MigratePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleMigrate = async () => {
    if (!confirm('Tem certeza que deseja migrar os leads antigos para os novos status? Esta ação é irreversível.')) {
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/migrate/fix-old-leads', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao executar migração')
      }

      setResult(data)
      toast.success(data.message)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Migração de Leads</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Migrar Leads Antigos</CardTitle>
            <CardDescription>
              Esta ferramenta migra leads com status antigos para os novos status do pipeline.
              Os mapeamentos são:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
              <p><strong>novo / new</strong> → <span className="text-blue-400">Backlog</span></p>
              <p><strong>qualificado / contacted</strong> → <span className="text-yellow-400">Em Contato</span></p>
              <p><strong>proposta / proposal / negotiation</strong> → <span className="text-orange-400">Em Negociação</span></p>
              <p><strong>fechado / won / closed</strong> → <span className="text-green-400">Negociação Fechada</span></p>
              <p><strong>lost / perdido / descartado</strong> → <span className="text-red-400">Lead Não Qualificado</span></p>
            </div>

            <Button
              onClick={handleMigrate}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Migrando...</>
              ) : (
                'Migrar Leads Antigos'
              )}
            </Button>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <p>{result.message}</p>
                </div>

                {result.details && result.details.filter(d => d.count > 0).length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                    <p className="font-semibold mb-2">Detalhes da migração:</p>
                    {result.details
                      .filter(d => d.count > 0)
                      .map((d, i) => (
                        <p key={i}>
                          <span className="text-muted-foreground">{d.from}</span> → <span className="font-medium">{d.to}</span>: <span className="text-green-400">{d.count} leads</span>
                        </p>
                      ))}
                  </div>
                )}

                {result.totalMigrated === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum lead com status antigo foi encontrado. Todos já estão nos novos status!
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
