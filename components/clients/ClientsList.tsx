'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { ClientData } from './ClientForm'

export interface Client extends ClientData {
  id: string
  created_at: string
}

interface ClientsListProps {
  clients: Client[]
  onEdit: (client: Client) => void
  onDelete: (id: string) => Promise<void>
  isLoading?: boolean
}

const statusColors = {
  active: 'default',
  inactive: 'secondary',
  prospect: 'outline',
} as const

const statusLabels = {
  active: 'Ativo',
  inactive: 'Inativo',
  prospect: 'Prospecto',
} as const

export function ClientsList({
  clients,
  onEdit,
  onDelete,
  isLoading = false,
}: ClientsListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDeleteConfirm = async () => {
    if (deleteId) {
      await onDelete(deleteId)
      setDeleteId(null)
    }
  }

  if (clients.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Nenhum cliente cadastrado</p>
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Criação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>{client.email}</TableCell>
                <TableCell>{client.phone}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {client.legal_entity_type === 'PF' ? 'PF' : 'PJ'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusColors[client.status]}>
                    {statusLabels[client.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(client.created_at), 'dd/MM/yyyy', {
                    locale: pt,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(client)}
                      disabled={isLoading}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(client.id)}
                      disabled={isLoading}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive">
              Deletar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
