'use client'

import { useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface ClientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ClientData) => Promise<void>
  initialData?: ClientData
  isLoading?: boolean
}

export interface ClientData {
  id?: string
  name: string
  email: string
  phone: string
  legal_entity_type: 'PF' | 'PJ'
  cpf_cnpj: string
  address: string
  city: string
  state: string
  zip_code: string
  notes: string
  status: 'active' | 'inactive' | 'prospect'
}

const initialFormState: ClientData = {
  name: '',
  email: '',
  phone: '',
  legal_entity_type: 'PF',
  cpf_cnpj: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  notes: '',
  status: 'active',
}

export function ClientForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading = false,
}: ClientFormProps) {
  const [formData, setFormData] = useState<ClientData>(initialData || initialFormState)

  const handleChange = (field: keyof ClientData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email) {
      toast.error('Nome e email são obrigatórios')
      return
    }

    try {
      await onSubmit(formData)
      setFormData(initialFormState)
      onOpenChange(false)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nome completo"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="email@exemplo.com.br"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Telefone</label>
              <Input
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="(11) 99999-9999"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo de Entidade</label>
              <Select
                value={formData.legal_entity_type}
                onValueChange={(value: any) =>
                  handleChange('legal_entity_type', value)
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">
                {formData.legal_entity_type === 'PF' ? 'CPF' : 'CNPJ'}
              </label>
              <Input
                value={formData.cpf_cnpj}
                onChange={(e) => handleChange('cpf_cnpj', e.target.value)}
                placeholder={formData.legal_entity_type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Estado</label>
              <Input
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cidade</label>
              <Input
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="São Paulo"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">CEP</label>
              <Input
                value={formData.zip_code}
                onChange={(e) => handleChange('zip_code', e.target.value)}
                placeholder="00000-000"
                disabled={isLoading}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Endereço</label>
              <Input
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Rua, número e complemento"
                disabled={isLoading}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => handleChange('status', value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="prospect">Prospecto</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Notas adicionais sobre o cliente"
                rows={3}
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
