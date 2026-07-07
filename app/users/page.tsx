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
import { Loader2, Plus, Pencil, Shield, ShieldAlert, KeyRound, Trash2 } from 'lucide-react';
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
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { isAdmin, canManageUsers, loading: permLoading } = usePermissions();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  // Reset password dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  // Delete dialog state
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('comercial');
  const [formSaving, setFormSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      // Use the API route (service role + auto-heal) instead of a direct browser
      // query, which is subject to RLS and can hide newly created users.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }
      const res = await fetch('/api/users/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao carregar usuários');
      }
      const data = await res.json();
      setUsers(data.users || []);
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

  const openResetDialog = (user: UserRecord) => {
    setResetUser(user);
    setResetPassword('');
    setResetDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (!resetPassword || resetPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    try {
      setResetSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }
      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: resetUser.id, newPassword: resetPassword }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao redefinir senha');
      }
      toast.success('Senha redefinida com sucesso!');
      setResetDialogOpen(false);
      setResetUser(null);
      setResetPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao redefinir senha');
    } finally {
      setResetSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    try {
      setDeleting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }
      const response = await fetch('/api/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: deleteUser.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir usuário');
      }
      toast.success('Usuário excluído com sucesso!');
      setDeleteUser(null);
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir usuário');
    } finally {
      setDeleting(false);
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
                    <TableHead>Criado em</TableHead>
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
                        <TableCell className="text-sm text-gray-400">
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
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
                              variant="outline"
                              size="sm"
                              onClick={() => openResetDialog(user)}
                              title="Redefinir senha"
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteUser(user)}
                              title="Excluir usuário"
                              className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
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
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) { setResetUser(null); setResetPassword(''); } }}>
        <DialogContent className="bg-slate-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-400">
              Defina uma nova senha para <span className="font-medium text-white">{resetUser?.full_name || resetUser?.email}</span>.
            </p>
            <div>
              <label className="text-sm font-medium">Nova Senha *</label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleResetPassword}
              disabled={resetSaving}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {resetSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                'Redefinir Senha'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null); }}>
        <DialogContent className="bg-slate-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-400">
              Tem certeza que deseja excluir <span className="font-medium text-white">{deleteUser?.full_name || deleteUser?.email}</span>?
              O usuário perderá o acesso ao sistema, mas seus registros históricos serão preservados.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
