'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { ClientForm, ClientData } from '@/components/clients/ClientForm'
import { ClientsList, Client } from '@/components/clients/ClientsList'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { logActivity } from '@/lib/activities'
import { usePermissions } from '@/hooks/usePermissions'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const { isAdmin, canDelete: userCanDelete, canEditAll, userId, loading: permLoading } = usePermissions()

  useEffect(() => {
    if (!permLoading && userId) {
      loadClients()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, userId, isAdmin])

  const loadClients = async () => {
    try {
      setLoading(true)

      // Use API route to bypass RLS for admins
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.')
        return
      }

      const response = await fetch('/api/clients', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Erro ao carregar clientes')

      const result = await response.json()
      setClients(result.clients || [])
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
        
        // Log the activity
        await logActivity(
          'update',
          'client',
          editingClient.id,
          `Cliente "${formData.name}" foi atualizado`,
          formData.name
        )
        
        toast.success('Cliente atualizado com sucesso')
        setEditingClient(null)
      } else {
        // Create new client
        const { data, error } = await supabase.from('clients').insert([
          {
            ...formData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: userId || 'system',
          },
        ]).select()

        if (error) throw error
        
        // Log the activity
        if (data && data.length > 0) {
          await logActivity(
            'create',
            'client',
            data[0].id,
            `Novo cliente "${formData.name}" foi criado`,
            formData.name
          )
        }
        
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
    if (!userCanDelete) {
      toast.error('Você não tem permissão para deletar clientes')
      return
    }

    try {
      // Get client name before deletion for logging
      const clientToDelete = clients.find(c => c.id === id)
      const clientName = clientToDelete?.name || 'Cliente desconhecido'

      const { error } = await supabase.from('clients').delete().eq('id', id)

      if (error) throw error

      // Log the activity
      await logActivity(
        'delete',
        'client',
        id,
        `Cliente "${clientName}" foi deletado`,
        clientName
      )

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
              {isAdmin
                ? 'Gerencie todos os clientes e informações de contato'
                : 'Gerencie seus clientes e informações de contato'}
            </p>
          </div>
          <Button onClick={handleNewClient} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>

        {loading || permLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ClientsList
            clients={clients}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={submitting}
            canEdit={canEditAll || true}
            canDeleteRecords={userCanDelete}
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
