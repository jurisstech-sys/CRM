'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, Pencil, Trash2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'
import { useRouter } from 'next/navigation'

interface Plan {
  id: string
  name: string
  description: string | null
  price: number | null
  is_custom: boolean
  active: boolean
  position: number
}

const fmtBRL = (v: number | null) =>
  v === null || v === undefined
    ? 'Personalizado'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function PlanosPage() {
  const router = useRouter()
  const { isAdmin, loading: permLoading } = usePermissions()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)

  // form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [active, setActive] = useState(true)
  const [position, setPosition] = useState('0')
  const [saving, setSaving] = useState(false)

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true)
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/plans?all=true', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar planos')
      setPlans(data.plans || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar planos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading) {
      if (!isAdmin) {
        toast.error('Acesso negado. Apenas administradores.')
        router.push('/dashboard')
        return
      }
      fetchPlans()
    }
  }, [permLoading, isAdmin, router, fetchPlans])

  const resetForm = () => {
    setName(''); setDescription(''); setPrice(''); setIsCustom(false); setActive(true); setPosition('0'); setEditing(null)
  }

  const openCreate = () => { resetForm(); setPosition(String(plans.length + 1)); setDialogOpen(true) }
  const openEdit = (p: Plan) => {
    setEditing(p)
    setName(p.name)
    setDescription(p.description || '')
    setPrice(p.price !== null ? String(p.price) : '')
    setIsCustom(p.is_custom)
    setActive(p.active)
    setPosition(String(p.position))
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return }
    if (!isCustom && (price === '' || isNaN(parseFloat(price)))) {
      toast.error('Informe o valor do plano ou marque como personalizado'); return
    }
    try {
      setSaving(true)
      const token = await getToken()
      if (!token) return
      const payload = {
        id: editing?.id,
        name: name.trim(),
        description: description.trim() || null,
        price: isCustom ? null : parseFloat(price),
        is_custom: isCustom,
        active,
        position: parseInt(position) || 0,
      }
      const res = await fetch('/api/plans', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar plano')
      toast.success(editing ? 'Plano atualizado!' : 'Plano criado!')
      setDialogOpen(false)
      resetForm()
      await fetchPlans()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: Plan) => {
    if (!window.confirm(`Excluir o plano "${p.name}"?`)) return
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/plans?id=${p.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir')
      toast.success(data.deactivated ? data.message : 'Plano excluído!')
      await fetchPlans()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir')
    }
  }

  if (permLoading || (!isAdmin && !permLoading)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="w-7 h-7 text-blue-500" /> Planos
            </h1>
            <p className="text-gray-400 mt-2">Cadastre e gerencie os planos comercializados</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Novo Plano
          </Button>
        </div>

        <Card className="p-6 border-gray-700 bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead>Plano</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                        Nenhum plano cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    plans.map((p) => (
                      <TableRow key={p.id} className="border-gray-700">
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-sm text-gray-400 max-w-xs truncate">{p.description || '-'}</TableCell>
                        <TableCell>
                          {p.is_custom ? (
                            <Badge variant="secondary">Personalizado</Badge>
                          ) : (
                            <span className="font-semibold text-green-500">{fmtBRL(p.price)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.active ? 'default' : 'secondary'}>
                            {p.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => openEdit(p)} title="Editar">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(p)}
                              title="Excluir"
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm() }}>
          <DialogContent className="bg-slate-900 border-gray-700">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Profissional" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do plano" className="mt-1" rows={2} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-700 p-3">
                <div>
                  <p className="text-sm font-medium">Valor personalizado</p>
                  <p className="text-xs text-gray-400">Para planos negociados (ex: Enterprise). O valor é definido no lead.</p>
                </div>
                <Switch checked={isCustom} onCheckedChange={setIsCustom} />
              </div>
              {!isCustom && (
                <div>
                  <label className="text-sm font-medium">Valor Mensal (R$) *</label>
                  <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="mt-1" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Posição</label>
                  <Input type="number" value={position} onChange={(e) => setPosition(e.target.value)} className="mt-1" />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-700 p-3">
                  <span className="text-sm font-medium">Ativo</span>
                  <Switch checked={active} onCheckedChange={setActive} />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
                {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>) : (editing ? 'Atualizar Plano' : 'Criar Plano')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
