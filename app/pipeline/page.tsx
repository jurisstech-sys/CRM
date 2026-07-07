'use client'

import React, { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'

interface NewLeadForm {
  title: string
  description: string
  source: string
  value: string
  expected_close_date: string
  probability: string
  client_id: string
}

export default function PipelinePage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<NewLeadForm>({
    title: '',
    description: '',
    source: 'direct',
    value: '',
    expected_close_date: '',
    probability: '50',
    client_id: '',
  })

  const { isAdmin, canDelete: userCanDelete, userId, user } = usePermissions()
  const currentUserName = user?.full_name || user?.email || null

  const handleCreateLead = async () => {
    if (!formData.title.trim()) {
      toast.error('Título do lead é obrigatório')
      return
    }

    try {
      setIsSubmitting(true)

      // Get current user session token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.')
        return
      }

      // Chama a API POST para criar o lead (usa service role no backend para bypass RLS)
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          source: formData.source,
          value: formData.value || null,
          expected_close_date: formData.expected_close_date || null,
          probability: formData.probability || '50',
          client_id: formData.client_id || null,
          currency: 'BRL',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar lead')
      }

      toast.success('Lead criado com sucesso')
      setFormData({
        title: '',
        description: '',
        source: 'direct',
        value: '',
        expected_close_date: '',
        probability: '50',
        client_id: '',
      })
      setIsCreateDialogOpen(false)

      // Refresh the page to show the new lead
      window.location.reload()
    } catch (error) {
      console.error('Error creating lead:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar lead')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 pb-12">
        <KanbanBoard
          onCreateLead={() => setIsCreateDialogOpen(true)}
          isAdminUser={isAdmin}
          canDeleteLeads={userCanDelete}
          currentUserId={userId}
          currentUserName={currentUserName}
        />

        {/* Create Lead Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Criar Novo Lead</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-400">
                  Título do Lead *
                </label>
                <Input
                  placeholder="Ex: Contrato de Consultoria"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">
                  Descrição
                </label>
                <Textarea
                  placeholder="Descrição adicional do lead"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-400">
                    Fonte
                  </label>
                  <Select value={formData.source} onValueChange={(value) =>
                    setFormData({ ...formData, source: value })
                  }>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="direct">Direto</SelectItem>
                      <SelectItem value="referral">Indicação</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="social">Redes Sociais</SelectItem>
                      <SelectItem value="event">Evento</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-400">
                    Valor
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-400">
                    Data de Fechamento Esperada
                  </label>
                  <Input
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expected_close_date: e.target.value,
                      })
                    }
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-400">
                    Probabilidade (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        probability: e.target.value,
                      })
                    }
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isSubmitting}
                className="border-slate-700"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateLead}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Lead'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
