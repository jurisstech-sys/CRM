import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// POST: Reset a user's password (admin only)
export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const accessToken = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify admin
    const { data: requester } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    const isAdmin = requester?.role === 'admin' || requester?.role === 'super_admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Apenas administradores podem redefinir senhas' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'userId e newPassword são obrigatórios' }, { status: 400 });
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      console.error('[Users Reset Password] Error:', error.message);
      return NextResponse.json({ error: `Erro ao redefinir senha: ${error.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (error) {
    console.error('[Users Reset Password] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
