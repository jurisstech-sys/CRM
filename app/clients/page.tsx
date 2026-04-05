'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { ClientForm, ClientData } from '@/components/clients/ClientForm'
import { ClientsList, Client } from '@/components/clients/ClientsList'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (formData: ClientData) => {
    try {
      setSubmitting(true)

      if (editingClient) {
        // Update existing client
        const { error } = await supabase
          .from('clients')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingClient.id)

        if (error) throw error
        toast.success('Cliente atualizado com sucesso')
        setEditingClient(null)
      } else {
        // Create new client
        const { error } = await supabase.from('clients').insert([
          {
            ...formData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: 'system', // TODO: Use actual user ID
          },
        ])

        if (error) throw error
        toast.success('Cliente criado com sucesso')
      }

      await loadClients()
      setFormOpen(false)
    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error('Erro ao salvar cliente')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id)

      if (error) throw error

      toast.success('Cliente deletado com sucesso')
      await loadClients()
    } catch (error) {
      console.error('Error deleting client:', error)
      toast.error('Erro ao deletar cliente')
    }
  }

  const handleNewClient = () => {
    setEditingClient(null)
    setFormOpen(true)
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie todos os seus clientes e informações de contato
            </p>
          </div>
          <Button onClick={handleNewClient} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ClientsList
            clients={clients}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={submitting}
          />
        )}
      </div>

      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        initialData={editingClient || undefined}
        isLoading={submitting}
      />
    </AppLayout>
  )
}