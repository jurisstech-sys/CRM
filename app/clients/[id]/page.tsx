'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { ClientForm, ClientData } from '@/components/clients/ClientForm'
import { Client } from '@/components/clients/ClientsList'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const loadClient = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (error) throw error
      if (!data) {
        toast.error('Cliente não encontrado')
        router.push('/clients')
        return
      }

      setClient(data)
      setFormOpen(true)
    } catch (error) {
      console.error('Error loading client:', error)
      toast.error('Erro ao carregar cliente')
      router.push('/clients')
    } finally {
      setLoading(false)
    }
  }, [clientId, router])

  useEffect(() => {
    loadClient()
  }, [loadClient])

  const handleSubmit = async (formData: ClientData) => {
    try {
      setSubmitting(true)
      const { error } = await supabase
        .from('clients')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)

      if (error) throw error

      toast.success('Cliente atualizado com sucesso')
      setFormOpen(false)
      setTimeout(() => router.push('/clients'), 1000)
    } catch (error) {
      console.error('Error updating client:', error)
      toast.error('Erro ao atualizar cliente')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cliente não encontrado</p>
          <Link href="/clients">
            <Button className="mt-4">Voltar para Clientes</Button>
          </Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link href="/clients" className="inline-block">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </Link>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-muted-foreground mt-2">{client.email}</p>
        </div>
      </div>

      <ClientForm
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            router.push('/clients')
          }
          setFormOpen(open)
        }}
        onSubmit={handleSubmit}
        initialData={client}
        isLoading={submitting}
      />
    </AppLayout>
  )
}