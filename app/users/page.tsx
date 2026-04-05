'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, UserX, UserCheck, Shield, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { getRoleLabel } from '@/lib/permissions';

interface UserRecord {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { isAdmin, canManageUsers, loading: permLoading } = usePermissions();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('comercial');
  const [formSaving, setFormSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data || []).map(u => ({
        ...u,
        is_active: u.is_active !== false, // default to true if null
      })));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permLoading) {
      if (!isAdmin) {
        toast.error('Acesso negado. Apenas administradores podem gerenciar usuários.');
        router.push('/dashboard');
        return;
      }
      fetchUsers();
    }
  }, [permLoading, isAdmin, router, fetchUsers]);

  const resetForm = () => {
    setFormEmail('');
    setFormPassword('');
    setFormName('');
    setFormRole('comercial');
    setEditingUser(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (user: UserRecord) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormName(user.full_name || '');
    setFormRole(user.role);
    setFormPassword('');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formEmail.trim()) {
      toast.error('Email é obrigatório');
      return;
    }

    try {
      setFormSaving(true);

      if (editingUser) {
        // UPDATE existing user
        const updateData: Record<string, unknown> = {
          full_name: formName.trim() || null,
          role: formRole,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;

        toast.success('Usuário atualizado com sucesso!');
      } else {
        // CREATE new user - create in auth first, then in users table
        if (!formPassword || formPassword.length < 6) {
          toast.error('Senha deve ter pelo menos 6 caracteres');
          setFormSaving(false);
          return;
        }

        // Use the API route to create user (needs service role key)
        const response = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formEmail.trim(),
            password: formPassword,
            full_name: formName.trim() || null,
            role: formRole,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Erro ao criar usuário');
        }

        toast.success('Usuário criado com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      await fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar usuário');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleUserActive = async (user: UserRecord) => {
    try {
      const newStatus = !user.is_active;
      const { error } = await supabase
        .from('users')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(newStatus ? 'Usuário ativado!' : 'Usuário desativado!');
      await fetchUsers();
    } catch (error) {
      console.error('Error toggling user:', error);
      toast.error('Erro ao alterar status do usuário');
    }
  };

  if (permLoading || (!isAdmin && !permLoading)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Usuários</h1>
            <p className="text-gray-400 mt-2">Gerencie os usuários do sistema</p>
          </div>
          {canManageUsers && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-gray-700">
                <DialogHeader>
                  <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium">Email *</label>
                    <Input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="mt-1"
                      disabled={!!editingUser}
                    />
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="text-sm font-medium">Senha *</label>
                      <Input
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Nome Completo</label>
                    <Input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Nome do usuário"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Papel</label>
                    <Select value={formRole} onValueChange={setFormRole}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o papel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="comercial">Comercial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={formSaving}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {formSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      editingUser ? 'Atualizar Usuário' : 'Criar Usuário'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Users Table */}
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map(user => (
                      <TableRow key={user.id} className="border-gray-700">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {user.role === 'admin' ? (
                              <ShieldAlert className="w-4 h-4 text-yellow-500" />
                            ) : (
                              <Shield className="w-4 h-4 text-blue-500" />
                            )}
                            {user.full_name || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'destructive'}>
                            {user.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(user)}
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={user.is_active ? 'destructive' : 'default'}
                              size="sm"
                              onClick={() => toggleUserActive(user)}
                              title={user.is_active ? 'Desativar' : 'Ativar'}
                            >
                              {user.is_active ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
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
      </div>
    </AppLayout>
  );
}
